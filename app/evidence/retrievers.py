"""Pluggable evidence retrieval with a deterministic local implementation."""

from __future__ import annotations

import json
import os
import unicodedata
from dataclasses import dataclass
from itertools import islice
from pathlib import Path
from typing import Any, Protocol

from google.api_core.client_options import ClientOptions
from google.cloud import discoveryengine_v1 as discoveryengine

from app.evidence.models import (
    EvidenceMatch,
    EvidenceQuery,
    EvidenceRecord,
    EvidenceStore,
)

DEFAULT_EVIDENCE_PATH = Path(__file__).parents[1] / "data" / "evidence.json"


class EvidenceRetriever(Protocol):
    """Contract later implemented by Agent Platform Search without agent rewrites."""

    backend_name: str

    def retrieve(self, query: EvidenceQuery) -> list[EvidenceMatch]: ...


@dataclass(frozen=True)
class AgentSearchConfig:
    """Validated Agent Platform Search resource configuration."""

    project_id: str
    region: str
    collection: str
    data_store_id: str
    serving_config_id: str = "default_config"
    timeout_seconds: float = 10.0

    @classmethod
    def from_env(cls) -> AgentSearchConfig:
        values = {
            "project_id": os.getenv("GOOGLE_CLOUD_PROJECT", "").strip(),
            "collection": os.getenv("DATA_STORE_COLLECTION", "").strip(),
            "data_store_id": os.getenv("DATA_STORE_ID", "").strip(),
        }
        missing = [name for name, value in values.items() if not value]
        if missing:
            joined = ", ".join(missing)
            raise ValueError(
                "Agent Platform Search configuration is incomplete: " + joined
            )
        timeout = float(os.getenv("AGENT_SEARCH_TIMEOUT_SECONDS", "10"))
        if timeout <= 0:
            raise ValueError("AGENT_SEARCH_TIMEOUT_SECONDS must be positive")
        return cls(
            project_id=values["project_id"],
            region=os.getenv("DATA_STORE_REGION", "global").strip() or "global",
            collection=values["collection"],
            data_store_id=values["data_store_id"],
            serving_config_id=(
                os.getenv("DATA_STORE_SERVING_CONFIG", "default_config").strip()
                or "default_config"
            ),
            timeout_seconds=timeout,
        )

    @property
    def serving_config_path(self) -> str:
        return (
            f"projects/{self.project_id}/locations/{self.region}"
            f"/collections/{self.collection}/dataStores/{self.data_store_id}"
            f"/servingConfigs/{self.serving_config_id}"
        )


def _normalize(value: str) -> str:
    return unicodedata.normalize("NFC", value).casefold()


class LocalEvidenceRetriever:
    """Retrieve only approved, version-matched evidence from a local JSON store."""

    backend_name = "local_json"

    def __init__(self, store: EvidenceStore):
        self._store = store

    @property
    def store(self) -> EvidenceStore:
        return self._store

    @classmethod
    def from_path(cls, path: Path) -> LocalEvidenceRetriever:
        with path.open(encoding="utf-8") as handle:
            payload = json.load(handle)
        return cls(EvidenceStore.model_validate(payload))

    @classmethod
    def from_default_store(cls) -> LocalEvidenceRetriever:
        return cls.from_path(DEFAULT_EVIDENCE_PATH)

    def retrieve(self, query: EvidenceQuery) -> list[EvidenceMatch]:
        candidates = [
            record
            for record in self._store.records
            if record.approved
            and record.domain == query.domain
            and record.version == query.version
        ]
        if query.domain == "culture":
            matches = self._retrieve_culture(candidates, query)
        else:
            matches = self._retrieve_dialect(candidates, query)
        return matches[: query.top_k]

    def _retrieve_culture(
        self, candidates: list[EvidenceRecord], query: EvidenceQuery
    ) -> list[EvidenceMatch]:
        matches: list[EvidenceMatch] = []
        for record in candidates:
            quest_match = bool(
                query.quest_id and query.quest_id in record.quest_ids
            )
            goal_match = bool(
                query.learning_goal_id
                and query.learning_goal_id in record.learning_goal_ids
            )
            if query.quest_id and not quest_match:
                continue
            if query.learning_goal_id and not goal_match:
                continue
            score = 1.0 if quest_match and goal_match else 0.9
            matches.append(
                EvidenceMatch(
                    record=record,
                    retrieval_score=score,
                    backend=self.backend_name,
                )
            )
        return sorted(
            matches,
            key=lambda match: (
                -match.retrieval_score,
                -match.record.priority,
                match.record.evidence_id,
            ),
        )

    def _retrieve_dialect(
        self, candidates: list[EvidenceRecord], query: EvidenceQuery
    ) -> list[EvidenceMatch]:
        normalized_answer = _normalize(query.user_text)
        allowlist = set(query.allowed_feature_ids)
        matches: list[EvidenceMatch] = []
        for record in candidates:
            if query.quest_id not in record.quest_ids:
                continue
            if record.feature_id not in allowlist:
                continue
            matched_terms = [
                form for form in record.forms if _normalize(form) in normalized_answer
            ]
            if not matched_terms:
                continue
            score = min(1.0, 0.8 + (0.05 * len(matched_terms)))
            matches.append(
                EvidenceMatch(
                    record=record,
                    retrieval_score=score,
                    matched_terms=matched_terms,
                    backend=self.backend_name,
                )
            )
        return sorted(
            matches,
            key=lambda match: (
                -match.retrieval_score,
                -match.record.priority,
                match.record.evidence_id,
            ),
        )


class AgentSearchEvidenceRetriever:
    """Use managed search for recall, then hydrate only locally approved records."""

    backend_name = "agent_platform_search"

    def __init__(
        self,
        *,
        config: AgentSearchConfig,
        approved_store: EvidenceStore,
        client: Any | None = None,
    ) -> None:
        self._config = config
        self._records_by_id = {
            record.evidence_id: record for record in approved_store.records
        }
        if client is not None:
            self._client = client
        else:
            client_options = (
                ClientOptions(
                    api_endpoint=f"{config.region}-discoveryengine.googleapis.com"
                )
                if config.region != "global"
                else None
            )
            self._client = discoveryengine.SearchServiceClient(
                client_options=client_options
            )

    @classmethod
    def from_env(cls) -> AgentSearchEvidenceRetriever:
        local = LocalEvidenceRetriever.from_default_store()
        return cls(
            config=AgentSearchConfig.from_env(),
            approved_store=local.store,
        )

    def retrieve(self, query: EvidenceQuery) -> list[EvidenceMatch]:
        remote_limit = min(100, max(10, query.top_k * 4))
        request = discoveryengine.SearchRequest(
            serving_config=self._config.serving_config_path,
            query=self._build_search_text(query),
            page_size=remote_limit,
        )
        page = self._client.search(
            request=request,
            timeout=self._config.timeout_seconds,
        )
        evidence_ids = []
        for result in islice(page, remote_limit):
            evidence_id = self._extract_evidence_id(result)
            if evidence_id and evidence_id not in evidence_ids:
                evidence_ids.append(evidence_id)

        candidate_store = EvidenceStore(
            records=[
                self._records_by_id[evidence_id]
                for evidence_id in evidence_ids
                if evidence_id in self._records_by_id
            ]
        )
        validated_matches = LocalEvidenceRetriever(candidate_store).retrieve(query)
        return [
            match.model_copy(update={"backend": self.backend_name})
            for match in validated_matches
        ]

    @staticmethod
    def _build_search_text(query: EvidenceQuery) -> str:
        parts = [
            f"domain {query.domain}",
            f"version {query.version}",
        ]
        if query.quest_id:
            parts.append(f"quest {query.quest_id}")
        if query.learning_goal_id:
            parts.append(f"learning goal {query.learning_goal_id}")
        if query.search_text:
            parts.append(query.search_text)
        if query.domain == "dialect":
            parts.extend(query.allowed_feature_ids)
            parts.append(query.user_text)
        return " ".join(parts)

    def _extract_evidence_id(self, result: Any) -> str | None:
        document = getattr(result, "document", None)
        if document is None:
            return None
        candidates = [getattr(document, "id", None)]
        for field_name in ("struct_data", "derived_struct_data"):
            fields = getattr(document, field_name, None)
            if fields is not None and hasattr(fields, "get"):
                candidates.append(fields.get("evidence_id"))
        name = getattr(document, "name", None)
        if name:
            candidates.append(str(name).rsplit("/", 1)[-1])
        for candidate in candidates:
            if candidate and str(candidate) in self._records_by_id:
                return str(candidate)
        return None


def create_evidence_retriever() -> EvidenceRetriever:
    """Select the evidence backend explicitly; managed mode fails closed."""

    backend = os.getenv("EVIDENCE_RETRIEVER_BACKEND", "local_json").strip().lower()
    if backend == "local_json":
        return LocalEvidenceRetriever.from_default_store()
    if backend in {"agent_search", "agent_platform_search"}:
        return AgentSearchEvidenceRetriever.from_env()
    raise ValueError(f"Unsupported EVIDENCE_RETRIEVER_BACKEND: {backend!r}")

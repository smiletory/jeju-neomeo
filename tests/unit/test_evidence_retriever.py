from __future__ import annotations

import json
import unicodedata
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest
from pydantic import ValidationError

from app.evidence import (
    AgentSearchConfig,
    AgentSearchEvidenceRetriever,
    EvidenceQuery,
    EvidenceStore,
    LocalEvidenceRetriever,
    create_evidence_retriever,
)


def test_default_store_returns_scoped_culture_evidence() -> None:
    retriever = LocalEvidenceRetriever.from_default_store()

    matches = retriever.retrieve(
        EvidenceQuery(
            domain="culture",
            quest_id="gujwa_songdang_01",
            learning_goal_id="SONGDANG_COMMUNITY_RITE",
        )
    )

    assert [match.record.evidence_id for match in matches] == [
        "songdang_01"
    ]
    assert matches[0].retrieval_score == 1.0
    assert matches[0].backend == "local_json"


def test_dialect_retrieval_obeys_feature_allowlist() -> None:
    retriever = LocalEvidenceRetriever.from_default_store()

    matches = retriever.retrieve(
        EvidenceQuery(
            domain="dialect",
            quest_id="gujwa_gimnyeong_01",
            user_text="제주 바당에서 멜을 잡았수다 마씸",
            allowed_feature_ids=["JEJ_LEXICON_BATANG", "JEJ_LEXICON_MEL"],
        )
    )

    assert {match.record.feature_id for match in matches} == {
        "JEJ_LEXICON_BATANG",
        "JEJ_LEXICON_MEL",
    }


def test_dialect_retrieval_normalizes_unicode() -> None:
    retriever = LocalEvidenceRetriever.from_default_store()
    decomposed = unicodedata.normalize("NFD", "바당")

    matches = retriever.retrieve(
        EvidenceQuery(
            domain="dialect",
            quest_id="gujwa_gimnyeong_01",
            user_text=f"제주 {decomposed}",
            allowed_feature_ids=["JEJ_LEXICON_BATANG"],
        )
    )

    assert matches[0].matched_terms == ["바당"]


def test_retrieval_does_not_cross_quest_scope() -> None:
    retriever = LocalEvidenceRetriever.from_default_store()

    culture_matches = retriever.retrieve(
        EvidenceQuery(
            domain="culture",
            quest_id="gujwa_songdang_01",
            learning_goal_id="GIMNYEONG_RITUAL_AND_LABOR",
        )
    )
    dialect_matches = retriever.retrieve(
        EvidenceQuery(
            domain="dialect",
            quest_id="gujwa_songdang_01",
            user_text="바당",
            allowed_feature_ids=["JEJ_LEXICON_BATANG"],
        )
    )

    assert culture_matches == []
    assert dialect_matches == []


def test_unapproved_and_wrong_version_records_are_never_returned(
    tmp_path: Path,
) -> None:
    payload = {
        "schema_version": "1.0",
        "records": [
            _culture_record("CULT_APPROVED", approved=True, version="2.0"),
            _culture_record("CULT_DRAFT", approved=False, version="1.0"),
        ],
    }
    path = tmp_path / "evidence.json"
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    retriever = LocalEvidenceRetriever.from_path(path)

    matches = retriever.retrieve(
        EvidenceQuery(
            domain="culture",
            quest_id="quest_01",
            learning_goal_id="GOAL_01",
            version="1.0",
        )
    )

    assert matches == []


def test_store_rejects_duplicate_evidence_ids() -> None:
    record = _culture_record("CULT_DUPLICATE")

    with pytest.raises(ValidationError, match="Evidence IDs must be unique"):
        EvidenceStore.model_validate(
            {"schema_version": "1.0", "records": [record, record]}
        )


class FakeSearchClient:
    def __init__(self, evidence_ids: list[str]) -> None:
        self.evidence_ids = evidence_ids
        self.request: Any | None = None
        self.timeout: float | None = None

    def search(self, *, request: Any, timeout: float) -> Any:
        self.request = request
        self.timeout = timeout
        return iter(
            [
                SimpleNamespace(
                    document=SimpleNamespace(
                        id="",
                        struct_data={"evidence_id": evidence_id},
                        derived_struct_data={},
                        name=f"documents/{evidence_id}",
                    )
                )
                for evidence_id in self.evidence_ids
            ]
        )


def _agent_search_retriever(
    client: FakeSearchClient,
) -> AgentSearchEvidenceRetriever:
    local = LocalEvidenceRetriever.from_default_store()
    return AgentSearchEvidenceRetriever(
        config=AgentSearchConfig(
            project_id="test-project",
            region="global",
            collection="jeju-neomeo-collection",
            data_store_id="jeju-neomeo-documents",
            timeout_seconds=7.5,
        ),
        approved_store=local.store,
        client=client,
    )


def test_agent_search_hydrates_only_locally_approved_scoped_records() -> None:
    client = FakeSearchClient(
        ["unknown_remote_record", "gimnyeong_01", "songdang_01"]
    )
    retriever = _agent_search_retriever(client)

    matches = retriever.retrieve(
        EvidenceQuery(
            domain="culture",
            quest_id="gujwa_songdang_01",
            learning_goal_id="SONGDANG_COMMUNITY_RITE",
            search_text="마을의 안녕과 공동체 의례",
        )
    )

    assert [match.record.evidence_id for match in matches] == ["songdang_01"]
    assert matches[0].backend == "agent_platform_search"
    assert client.timeout == 7.5
    assert client.request.serving_config.endswith(
        "/collections/jeju-neomeo-collection/dataStores/"
        "jeju-neomeo-documents/servingConfigs/default_config"
    )
    assert "SONGDANG_COMMUNITY_RITE" in client.request.query


def test_agent_search_dialect_still_requires_allowlisted_form_in_answer() -> None:
    client = FakeSearchClient(
        ["dialect_badang_01", "dialect_mel_01", "songdang_01"]
    )
    retriever = _agent_search_retriever(client)

    matches = retriever.retrieve(
        EvidenceQuery(
            domain="dialect",
            quest_id="gujwa_gimnyeong_01",
            user_text="바당에서 멜을 잡았수다.",
            allowed_feature_ids=["JEJ_LEXICON_BATANG"],
        )
    )

    assert [match.record.feature_id for match in matches] == [
        "JEJ_LEXICON_BATANG"
    ]
    assert matches[0].matched_terms == ["바당"]


def test_agent_search_configuration_fails_closed_when_incomplete(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("EVIDENCE_RETRIEVER_BACKEND", "agent_platform_search")
    monkeypatch.delenv("DATA_STORE_COLLECTION", raising=False)
    monkeypatch.delenv("DATA_STORE_ID", raising=False)

    with pytest.raises(ValueError, match="configuration is incomplete"):
        create_evidence_retriever()


def test_unknown_retrieval_backend_is_rejected(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("EVIDENCE_RETRIEVER_BACKEND", "untrusted_backend")

    with pytest.raises(ValueError, match="Unsupported"):
        create_evidence_retriever()


def _culture_record(
    evidence_id: str,
    *,
    approved: bool = True,
    version: str = "1.0",
) -> dict[str, object]:
    return {
        "evidence_id": evidence_id,
        "domain": "culture",
        "version": version,
        "approved": approved,
        "quest_ids": ["quest_01"],
        "learning_goal_ids": ["GOAL_01"],
        "content": "검증용 문화 근거",
        "source": {
            "title": "검증 자료",
            "publisher": "검증 기관",
            "url": "https://example.com/evidence",
            "accessed_at": "2026-08-23",
        },
    }

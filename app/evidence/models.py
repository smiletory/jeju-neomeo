"""Versioned contracts for culture and Jeju-language evidence."""

from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, HttpUrl, model_validator

EvidenceDomain = Literal["culture", "dialect"]


class EvidenceSource(BaseModel):
    """Provenance retained with every approved claim or language feature."""

    title: str = Field(min_length=1)
    publisher: str = Field(min_length=1)
    url: HttpUrl
    accessed_at: date
    license: str | None = None


class EvidenceRecord(BaseModel):
    """One reviewable unit of evidence, independent from NPC question wording."""

    evidence_id: str = Field(pattern=r"^[A-Za-z0-9_]+$")
    domain: EvidenceDomain
    version: str = Field(min_length=1)
    approved: bool = False
    priority: int = Field(default=0, ge=0, le=100)
    quest_ids: list[str] = Field(default_factory=list)
    learning_goal_ids: list[str] = Field(default_factory=list)
    content: str = Field(min_length=1)
    source: EvidenceSource

    # Dialect-only fields. Culture records leave these empty.
    feature_id: str | None = None
    forms: list[str] = Field(default_factory=list)
    standard_meanings: list[str] = Field(default_factory=list)
    usage_contexts: list[str] = Field(default_factory=list)
    positive_examples: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_domain_fields(self) -> EvidenceRecord:
        if self.domain == "culture":
            if not self.quest_ids or not self.learning_goal_ids:
                raise ValueError(
                    "Culture evidence requires quest_ids and learning_goal_ids"
                )
            if self.feature_id is not None or self.forms:
                raise ValueError(
                    "Culture evidence cannot define dialect feature_id or forms"
                )
        elif not self.feature_id or not self.forms:
            raise ValueError("Dialect evidence requires feature_id and forms")
        return self


class EvidenceStore(BaseModel):
    schema_version: str = "1.0"
    records: list[EvidenceRecord]

    @model_validator(mode="after")
    def reject_duplicate_ids(self) -> EvidenceStore:
        ids = [record.evidence_id for record in self.records]
        if len(ids) != len(set(ids)):
            raise ValueError("Evidence IDs must be unique")
        return self


class EvidenceQuery(BaseModel):
    """Backend-neutral request used by local and managed search adapters."""

    domain: EvidenceDomain
    version: str = "1.0"
    quest_id: str | None = None
    learning_goal_id: str | None = None
    user_text: str = ""
    search_text: str = ""
    allowed_feature_ids: list[str] = Field(default_factory=list)
    top_k: int = Field(default=5, ge=1, le=20)

    @model_validator(mode="after")
    def validate_query_scope(self) -> EvidenceQuery:
        if self.domain == "culture" and not (
            self.quest_id or self.learning_goal_id
        ):
            raise ValueError(
                "Culture queries require quest_id or learning_goal_id"
            )
        if self.domain == "dialect":
            if not self.quest_id:
                raise ValueError("Dialect queries require quest_id")
            if not self.user_text.strip():
                raise ValueError("Dialect queries require user_text")
            if not self.allowed_feature_ids:
                raise ValueError(
                    "Dialect queries require allowed_feature_ids"
                )
        return self


class EvidenceMatch(BaseModel):
    record: EvidenceRecord
    retrieval_score: float = Field(ge=0.0, le=1.0)
    matched_terms: list[str] = Field(default_factory=list)
    backend: str = Field(min_length=1)

"""Structured contracts shared by the Jeju Neomeo agents and game API."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class CultureResult(BaseModel):
    answer_relevance: Literal[
        "on_topic",
        "partially_related",
        "off_topic",
        "nonsense",
        "misconception",
    ] = "on_topic"
    knowledge_pass: bool
    score: float = Field(ge=0.0, le=1.0)
    matched_concepts: list[str] = Field(default_factory=list)
    missing_concepts: list[str] = Field(default_factory=list)
    incorrect_claims: list[str] = Field(default_factory=list)
    evidence_ids: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0)


class DialectResult(BaseModel):
    dialect_pass: bool
    score: float = Field(ge=0.0, le=1.0)
    evaluation_skipped: bool = False
    detected_feature_ids: list[str] = Field(default_factory=list)
    matched_required_group_ids: list[str] = Field(default_factory=list)
    missing_required_group_ids: list[str] = Field(default_factory=list)
    misused_expressions: list[str] = Field(default_factory=list)
    unsupported_expressions: list[str] = Field(default_factory=list)
    standard_korean_only: bool = False
    recommended_feature_ids: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0)


Verdict = Literal[
    "pass",
    "retry_relevance",
    "retry_knowledge",
    "retry_dialect",
    "retry_both",
    "needs_review",
    "input_rejected",
    "system_error",
]


class VerificationResult(BaseModel):
    verification_pass: bool
    conflict_detected: bool
    invalid_evidence_ids: list[str] = Field(default_factory=list)
    invalid_feature_ids: list[str] = Field(default_factory=list)
    invalid_hint_ids: list[str] = Field(default_factory=list)
    recommended_verdict: Verdict
    hint_id: str | None = None
    confidence: float = Field(ge=0.0, le=1.0)


class EvaluationRequest(BaseModel):
    quest_id: str = Field(min_length=1, max_length=80)
    question_id: str | None = Field(default=None, min_length=1, max_length=80)
    user_answer: str = Field(min_length=1, max_length=800)
    attempt: int = Field(default=1, ge=1, le=20)
    rubric_version: str = Field(default="1.0", max_length=20)


class EvaluationResponse(BaseModel):
    verdict: Verdict
    knowledge_score: float = Field(ge=0.0, le=1.0)
    dialect_score: float = Field(ge=0.0, le=1.0)
    feedback_knowledge: str
    feedback_dialect: str
    hint_id: str | None = None
    hint: str | None = None
    trace_id: str
    question_id: str | None = None
    learning_goal_id: str | None = None
    retrieval_backend: str | None = None
    grounding_evidence_ids: list[str] = Field(default_factory=list)
    stages: list[str] = Field(default_factory=list)

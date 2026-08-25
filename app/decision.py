"""Deterministic gate that owns the final game progression decision."""

from __future__ import annotations

import json
from typing import Any, TypeVar

from pydantic import BaseModel

from app.schemas import (
    CultureResult,
    DialectResult,
    EvaluationResponse,
    VerificationResult,
)

MIN_CONFIDENCE = 0.72
ModelT = TypeVar("ModelT", bound=BaseModel)


def parse_state_model(value: Any, model: type[ModelT]) -> ModelT:
    if isinstance(value, model):
        return value
    if isinstance(value, str):
        return model.model_validate(json.loads(value))
    return model.model_validate(value)


def resolve_decision(
    *,
    culture: CultureResult,
    dialect: DialectResult,
    verification: VerificationResult,
    rubric: dict[str, Any],
    hints: dict[str, str],
    trace_id: str,
    attempt: int = 1,
    question_id: str | None = None,
    learning_goal_id: str | None = None,
    allowed_evidence_ids: set[str] | None = None,
    allowed_dialect_feature_ids: set[str] | None = None,
    required_dialect_group_ids: set[str] | None = None,
    requires_culture_evidence: bool = True,
    retrieval_backend: str | None = None,
) -> EvaluationResponse:
    allowed_evidence = (
        allowed_evidence_ids
        if allowed_evidence_ids is not None
        else {item["id"] for item in rubric["evidence"]}
    )
    allowed_features = (
        allowed_dialect_feature_ids
        if allowed_dialect_feature_ids is not None
        else set(rubric["allowed_feature_ids"])
    )
    allowed_hints = set(rubric["hint_ids"])
    evidence_valid = set(culture.evidence_ids).issubset(allowed_evidence) and (
        not requires_culture_evidence
        or not culture.knowledge_pass
        or bool(culture.evidence_ids)
    )
    required_groups = required_dialect_group_ids or set()
    matched_groups = set(dialect.matched_required_group_ids)
    group_ids_valid = matched_groups.issubset(required_groups)
    all_groups_matched = not required_groups or required_groups.issubset(
        matched_groups
    )
    dialect_grounded = (
        bool(dialect.detected_feature_ids)
        if not required_groups
        else all_groups_matched
    )
    dialect_valid = (
        set(dialect.detected_feature_ids).issubset(allowed_features)
        and group_ids_valid
        and (
            dialect.evaluation_skipped
            or not dialect.dialect_pass
            or dialect_grounded
        )
    )
    hint_valid = verification.hint_id is None or verification.hint_id in allowed_hints
    confidences = [culture.confidence, verification.confidence]
    if not dialect.evaluation_skipped:
        confidences.append(dialect.confidence)
    confidence_ok = min(confidences) >= MIN_CONFIDENCE

    if (
        not evidence_valid
        or not dialect_valid
        or not hint_valid
        or verification.invalid_evidence_ids
        or verification.invalid_feature_ids
        or verification.invalid_hint_ids
    ):
        verdict = "system_error"
    elif culture.answer_relevance in {"off_topic", "nonsense"}:
        verdict = "retry_relevance"
    elif culture.answer_relevance == "misconception":
        verdict = "retry_knowledge"
    elif verification.conflict_detected or not confidence_ok:
        verdict = "needs_review"
    elif (
        culture.knowledge_pass
        and dialect.dialect_pass
        and verification.verification_pass
    ):
        verdict = "pass"
    elif dialect.evaluation_skipped:
        verdict = "retry_knowledge"
    elif not culture.knowledge_pass and not dialect.dialect_pass:
        verdict = "retry_both"
    elif not culture.knowledge_pass:
        verdict = "retry_knowledge"
    else:
        verdict = "retry_dialect"

    hint_id = None if verdict == "pass" else verification.hint_id
    if verdict == "retry_relevance":
        hint_id = rubric["fallback_hint_by_verdict"].get("retry_relevance")
        if not hint_id:
            hint_id = (
                "INPUT_OFF_TOPIC_03"
                if attempt >= 3
                else "INPUT_OFF_TOPIC_02"
                if attempt == 2
                else "INPUT_OFF_TOPIC_01"
            )
    elif hint_id not in hints:
        hint_id = rubric["fallback_hint_by_verdict"].get(verdict)

    if verdict == "retry_relevance":
        knowledge_feedback = "현재 대화 상황에 맞는 뜻을 담아 답해주세요."
    else:
        knowledge_feedback = (
            "상황과 문화적 의미를 정확하게 전달했습니다."
            if culture.knowledge_pass
            else "현재 상황에서 전달해야 할 핵심 의미를 다시 확인해보세요."
        )
    has_standard_formal_ending = any(
        expression.startswith("표준어 종결형:")
        for expression in dialect.unsupported_expressions
    )
    if dialect.evaluation_skipped:
        dialect_feedback = (
            "1단계에서 멈춰 제주어 표현은 아직 검사하지 않았습니다."
        )
    elif dialect.dialect_pass:
        dialect_feedback = "제주어 표현이 퀘스트 기준에 맞습니다."
    elif has_standard_formal_ending:
        dialect_feedback = (
            "문장 끝의 '-습니다/-ㅂ니다'를 근거가 확인된 제주어 "
            "종결 표현으로 바꿔보세요."
        )
    else:
        dialect_feedback = "제주어 표현을 조금 더 보완해보세요."

    return EvaluationResponse(
        verdict=verdict,
        knowledge_score=culture.score,
        dialect_score=dialect.score,
        feedback_knowledge=knowledge_feedback,
        feedback_dialect=dialect_feedback,
        hint_id=hint_id,
        hint=hints.get(hint_id) if hint_id else None,
        trace_id=trace_id,
        question_id=question_id,
        learning_goal_id=learning_goal_id,
        retrieval_backend=retrieval_backend,
        grounding_evidence_ids=sorted(set(culture.evidence_ids)),
        stages=(
            [
                "evidence_retrieval_complete",
                "culture_complete",
                "dialect_skipped_due_to_meaning",
                "verification_complete",
            ]
            if dialect.evaluation_skipped
            else [
                "evidence_retrieval_complete",
                "culture_complete",
                "dialect_complete",
                "dialect_quality_gate_complete",
                "verification_complete",
            ]
        ),
    )

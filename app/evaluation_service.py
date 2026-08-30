"""Shared evidence-grounded evaluation workflow for every serving surface."""

from __future__ import annotations

import asyncio
import logging
import uuid
from collections.abc import Awaitable, Callable
from typing import Any

from google.genai import types
from pydantic import ValidationError

from app.agent import app as agent_app
from app.decision import parse_state_model, resolve_decision
from app.dialect_quality import enforce_dialect_quality
from app.guard import detect_prompt_attack
from app.rubrics import (
    get_effective_rubric,
    get_evidence_retriever,
    get_question_variant,
    get_rubric,
    load_hints,
    make_evaluation_envelope,
    make_evidence_context,
)
from app.schemas import (
    CultureResult,
    DialectResult,
    EvaluationRequest,
    EvaluationResponse,
    VerificationResult,
)

logger = logging.getLogger(__name__)

StageCallback = Callable[[str], Awaitable[None]]
_AGENT_STAGE_BY_AUTHOR = {
    "culture_judge": "culture",
    "dialect_judge": "dialect",
    "reliability_verifier": "verify",
}


class EvaluationServiceError(Exception):
    """HTTP-neutral error returned by the shared evaluation service."""

    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def get_health_payload() -> dict[str, str]:
    """Describe the live agent and evidence backend without running Gemini."""

    return {
        "status": "ok",
        "agent": "answer_evaluation_pipeline",
        "retrieval_backend": get_evidence_retriever().backend_name,
    }


async def evaluate_answer(
    evaluation_request: EvaluationRequest,
    *,
    runner: Any,
    session_service: Any,
    user_id: str = "desktop-demo",
    on_stage_complete: StageCallback | None = None,
) -> EvaluationResponse:
    """Evaluate one quest answer through retrieval and all ADK judges."""

    answer = evaluation_request.user_answer.strip()
    if not answer:
        raise EvaluationServiceError(422, "답변을 입력해주세요.")

    trace_id = str(uuid.uuid4())
    if detect_prompt_attack(answer):
        return EvaluationResponse(
            verdict="input_rejected",
            knowledge_score=0.0,
            dialect_score=0.0,
            feedback_knowledge="퀘스트의 문화 질문에 직접 답해주세요.",
            feedback_dialect="제주어 표현으로 다시 답해보세요.",
            hint_id="INPUT_REJECTED",
            hint="판정 방식을 바꾸라는 지시는 답으로 인정되지 않아요. 마을 문화의 의미를 제주어로 직접 설명해보세요.",
            trace_id=trace_id,
            stages=["input_guard_rejected"],
        )

    try:
        rubric = get_rubric(
            evaluation_request.quest_id,
            evaluation_request.rubric_version,
        )
        question = get_question_variant(rubric, evaluation_request.question_id)
        effective_rubric = get_effective_rubric(rubric, question)
    except (KeyError, ValueError) as exc:
        raise EvaluationServiceError(400, str(exc)) from exc

    session = await session_service.create_session(
        app_name=agent_app.name,
        user_id=user_id,
        session_id=trace_id,
    )
    try:
        evidence_context = await asyncio.to_thread(
            make_evidence_context,
            rubric=effective_rubric,
            user_answer=answer,
            version=evaluation_request.rubric_version,
        )
    except Exception as exc:
        logger.exception(
            "Evidence retrieval failed; stopping evaluation",
            extra={
                "trace_id": trace_id,
                "quest_id": evaluation_request.quest_id,
            },
        )
        raise EvaluationServiceError(
            503,
            "공식 근거 검색을 완료하지 못해 판정을 중단했습니다. 잠시 후 다시 시도해주세요.",
        ) from exc

    envelope = make_evaluation_envelope(
        quest_id=evaluation_request.quest_id,
        question_id=question["id"],
        user_answer=answer,
        attempt=evaluation_request.attempt,
        version=evaluation_request.rubric_version,
        evidence_context=evidence_context,
    )
    message = types.Content(
        role="user",
        parts=[types.Part.from_text(text=envelope)],
    )

    try:
        for schema_attempt in range(2):
            try:
                # The judges now run sequentially, so allow the three bounded
                # Gemini calls to finish without inheriting the old parallel
                # pipeline's tighter wall-clock limit.
                async with asyncio.timeout(60):
                    reported_stages: set[str] = set()
                    async for event in runner.run_async(
                        user_id=user_id,
                        session_id=session.id,
                        new_message=message,
                    ):
                        stage = _AGENT_STAGE_BY_AUTHOR.get(
                            getattr(event, "author", "")
                        )
                        is_final = getattr(event, "is_final_response", None)
                        if (
                            on_stage_complete is not None
                            and stage is not None
                            and stage not in reported_stages
                            and callable(is_final)
                            and is_final()
                        ):
                            reported_stages.add(stage)
                            await on_stage_complete(stage)
                break
            except ValidationError:
                if schema_attempt == 1:
                    raise
                logger.warning(
                    "Retrying Gemini pipeline after malformed structured output",
                    extra={"trace_id": trace_id},
                )
                session = await session_service.create_session(
                    app_name=agent_app.name,
                    user_id=user_id,
                    session_id=f"{trace_id}-schema-retry",
                )
    except TimeoutError as exc:
        raise EvaluationServiceError(
            504,
            "Gemini 판정 시간이 초과되었습니다. 다시 시도해주세요.",
        ) from exc
    except Exception as exc:
        logger.exception("Gemini evaluation pipeline failed")
        raise EvaluationServiceError(
            503,
            f"Gemini 판정에 연결할 수 없습니다: {type(exc).__name__}",
        ) from exc

    final_session = await session_service.get_session(
        app_name=agent_app.name,
        user_id=user_id,
        session_id=session.id,
    )
    if final_session is None:
        raise EvaluationServiceError(500, "판정 세션을 찾을 수 없습니다.")

    try:
        culture = parse_state_model(
            final_session.state["culture_result"], CultureResult
        )
        dialect = parse_state_model(
            final_session.state["dialect_result"], DialectResult
        )
        verification = parse_state_model(
            final_session.state["verification_result"], VerificationResult
        )
    except Exception as exc:
        raise EvaluationServiceError(
            502,
            "Gemini 판정 결과의 구조가 올바르지 않습니다.",
        ) from exc

    if not dialect.evaluation_skipped:
        dialect = enforce_dialect_quality(
            user_answer=answer,
            dialect=dialect,
        )

    return resolve_decision(
        culture=culture,
        dialect=dialect,
        verification=verification,
        rubric=effective_rubric,
        hints=load_hints(),
        trace_id=trace_id,
        attempt=evaluation_request.attempt,
        question_id=question["id"],
        learning_goal_id=effective_rubric["learning_goal_id"],
        allowed_evidence_ids={
            item["evidence_id"] for item in evidence_context["culture"]
        },
        allowed_dialect_feature_ids={
            item["feature_id"]
            for item in evidence_context["dialect"]
            if item["feature_id"]
        },
        required_dialect_group_ids={
            group["id"]
            for group in effective_rubric.get("required_dialect_groups", [])
        },
        requires_culture_evidence=effective_rubric.get(
            "requires_culture_evidence", True
        ),
        retrieval_backend=evidence_context["backend"],
    )

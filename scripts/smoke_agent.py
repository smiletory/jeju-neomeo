"""Run one real Vertex AI Gemini evaluation without shell-encoding Korean text."""

from __future__ import annotations

import argparse
import asyncio
import json

from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

from app.agent import app as agent_app
from app.decision import parse_state_model, resolve_decision
from app.rubrics import (
    get_effective_rubric,
    get_question_variant,
    get_rubric,
    load_hints,
    make_evaluation_envelope,
)
from app.schemas import CultureResult, DialectResult, VerificationResult

CASES = {
    "standard": {
        "question_id": "community_meaning",
        "answer": "마을 사람들이 함께 마을의 안녕과 생업을 빌며 문화를 이어왔습니다.",
        "attempt": 1,
    },
    "off_topic": {
        "question_id": "community_reason",
        "answer": "삼춘, 오늘 치킨 먹고 싶수다.",
        "attempt": 1,
    },
    "jeju_pass": {
        "question_id": "collective_wish",
        "answer": "송당 사람덜이 모영 마을의 안녕과 생업을 빌며 문화를 이어온 거우다.",
        "attempt": 1,
    },
    "practice_greeting_pass": {
        "question_id": "practice_greeting",
        "answer": "삼춘, 안녕하우꽈?",
        "attempt": 1,
    },
    "practice_greeting_nonsense": {
        "question_id": "practice_greeting",
        "answer": "삼춘 안녕하우꽈 치킨 자동차 바당",
        "attempt": 1,
    },
    "practice_purpose_keyword_nonsense": {
        "question_id": "practice_purpose",
        "answer": "할망 왔수다 삼춘 이서마씸 기억 치킨 자동차",
        "attempt": 1,
    },
}


async def run_case(case_name: str) -> dict[str, object]:
    case = CASES[case_name]
    quest_id = "gujwa_songdang_01"
    rubric = get_rubric(quest_id, "1.0")
    question = get_question_variant(rubric, str(case["question_id"]))
    effective_rubric = get_effective_rubric(rubric, question)
    trace_id = f"smoke-{case_name}"

    session_service = InMemorySessionService()
    session = await session_service.create_session(
        app_name=agent_app.name,
        user_id="smoke-test",
        session_id=trace_id,
    )
    runner = Runner(
        app=agent_app,
        session_service=session_service,
        auto_create_session=True,
    )
    envelope = make_evaluation_envelope(
        quest_id=quest_id,
        question_id=question["id"],
        user_answer=str(case["answer"]),
        attempt=int(case["attempt"]),
        version="1.0",
    )
    envelope_data = json.loads(envelope)
    message = types.Content(
        role="user", parts=[types.Part.from_text(text=envelope)]
    )

    async for _event in runner.run_async(
        user_id="smoke-test",
        session_id=session.id,
        new_message=message,
    ):
        pass

    final_session = await session_service.get_session(
        app_name=agent_app.name,
        user_id="smoke-test",
        session_id=session.id,
    )
    if final_session is None:
        raise RuntimeError("Smoke-test session disappeared")

    culture = parse_state_model(final_session.state["culture_result"], CultureResult)
    dialect = parse_state_model(final_session.state["dialect_result"], DialectResult)
    verification = parse_state_model(
        final_session.state["verification_result"], VerificationResult
    )
    response = resolve_decision(
        culture=culture,
        dialect=dialect,
        verification=verification,
        rubric=effective_rubric,
        hints=load_hints(),
        trace_id=trace_id,
        attempt=int(case["attempt"]),
        question_id=question["id"],
        learning_goal_id=effective_rubric["learning_goal_id"],
        allowed_evidence_ids={
            item["evidence_id"]
            for item in envelope_data["retrieved_evidence"]["culture"]
        },
        allowed_dialect_feature_ids={
            item["feature_id"]
            for item in envelope_data["retrieved_evidence"]["dialect"]
            if item["feature_id"]
        },
        required_dialect_group_ids={
            group["id"]
            for group in effective_rubric.get("required_dialect_groups", [])
        },
        requires_culture_evidence=effective_rubric.get(
            "requires_culture_evidence", True
        ),
    )
    return {
        "case": case_name,
        "question_id": question["id"],
        "culture": culture.model_dump(),
        "dialect": dialect.model_dump(),
        "verification": verification.model_dump(),
        "decision": response.model_dump(),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--case", choices=sorted(CASES), default="standard")
    args = parser.parse_args()
    result = asyncio.run(run_case(args.case))
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

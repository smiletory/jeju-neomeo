import json
from collections.abc import Iterator

import pytest

from app.rubrics import (
    get_evidence_retriever,
    get_question_variant,
    get_rubric,
    make_evaluation_envelope,
)


@pytest.fixture(autouse=True)
def local_evidence_backend(
    monkeypatch: pytest.MonkeyPatch,
) -> Iterator[None]:
    """Keep question-contract tests deterministic across runtime backends."""

    monkeypatch.setenv("EVIDENCE_RETRIEVER_BACKEND", "local_json")
    get_evidence_retriever.cache_clear()
    yield
    get_evidence_retriever.cache_clear()


def test_question_variants_share_the_same_evaluation_goal() -> None:
    rubric = get_rubric("gujwa_songdang_01", "1.0")
    first = json.loads(
        make_evaluation_envelope(
            quest_id=rubric["quest_id"],
            question_id="community_reason",
            user_answer="마을 사람들이 함께 마을의 안녕을 빌었습니다.",
            attempt=1,
            version="1.0",
        )
    )
    second = json.loads(
        make_evaluation_envelope(
            quest_id=rubric["quest_id"],
            question_id="community_meaning",
            user_answer="마을 사람들이 함께 마을의 안녕을 빌었습니다.",
            attempt=1,
            version="1.0",
        )
    )

    assert first["display_question"] != second["display_question"]
    assert first["evaluation_task"] == second["evaluation_task"]
    assert first["evaluation_task"]["learning_goal_id"] == (
        "SONGDANG_COMMUNITY_RITE"
    )
    assert "evidence" not in first["rubric"]
    assert first["retrieved_evidence"]["backend"] == "local_json"
    assert [
        item["evidence_id"]
        for item in first["retrieved_evidence"]["culture"]
    ] == ["songdang_01"]
    assert first["retrieved_evidence"]["culture"][0]["source"]["url"].startswith(
        "https://"
    )


def test_envelope_only_includes_dialect_features_detected_in_answer() -> None:
    envelope = json.loads(
        make_evaluation_envelope(
            quest_id="gujwa_gimnyeong_01",
            question_id="ritual_and_work_song",
            user_answer="바당에서 멜을 잡는 노동요우다.",
            attempt=1,
            version="1.0",
        )
    )

    retrieved_features = {
        item["feature_id"]
        for item in envelope["retrieved_evidence"]["dialect"]
    }
    assert retrieved_features == {
        "JEJ_ENDING_UDA",
        "JEJ_LEXICON_BATANG",
        "JEJ_LEXICON_MEL",
    }
    assert all(
        item["matched_terms"]
        for item in envelope["retrieved_evidence"]["dialect"]
    )


def test_default_question_is_allowlisted() -> None:
    rubric = get_rubric("gujwa_songdang_01", "1.0")
    question = get_question_variant(rubric, None)
    assert question["id"] == rubric["default_question_id"]


def test_unknown_question_id_is_rejected() -> None:
    rubric = get_rubric("gujwa_songdang_01", "1.0")
    with pytest.raises(ValueError, match="Unsupported question_id"):
        get_question_variant(rubric, "invented_question")


def test_songdang_practice_question_uses_situational_rules_without_rag() -> None:
    envelope = json.loads(
        make_evaluation_envelope(
            quest_id="gujwa_songdang_01",
            question_id="practice_greeting",
            user_answer="삼춘, 안녕하우꽈?",
            attempt=1,
            version="1.0",
        )
    )

    assert envelope["evaluation_task"]["evaluation_type"] == "situational_intent"
    assert envelope["retrieved_evidence"]["culture"] == []
    assert {
        group["id"] for group in envelope["rubric"]["required_dialect_groups"]
    } == {"greeting_address", "greeting_salutation"}


def test_hado_protection_question_uses_two_stage_situational_contract() -> None:
    envelope = json.loads(
        make_evaluation_envelope(
            quest_id="gujwa_hado_01",
            question_id="practice_protection_request",
            user_answer="문주란 꺾지 맙서. 소중히 지켜줍서.",
            attempt=1,
            version="1.0",
        )
    )

    assert envelope["evaluation_task"]["evaluation_type"] == "situational_intent"
    assert envelope["retrieved_evidence"]["culture"] == []
    assert envelope["evaluation_task"]["required_concepts"] == [
        "문주란을 꺾지 말라고 함",
        "문주란을 지켜달라고 요청함",
    ]
    assert {
        group["id"] for group in envelope["rubric"]["required_dialect_groups"]
    } == {"protection_prohibition", "protection_request"}


def test_gimnyeong_group_pull_uses_two_stage_situational_contract() -> None:
    envelope = json.loads(
        make_evaluation_envelope(
            quest_id="gujwa_gimnyeong_01",
            question_id="practice_group_pull",
            user_answer="다 같이 모영 멜 그물을 당겨봅서!",
            attempt=1,
            version="1.0",
        )
    )

    assert envelope["evaluation_task"]["evaluation_type"] == "situational_intent"
    assert envelope["retrieved_evidence"]["culture"] == []
    assert envelope["evaluation_task"]["required_concepts"] == [
        "여럿이 함께 모이자고 함",
        "멸치 그물을 당기자고 함",
    ]
    assert {
        group["id"] for group in envelope["rubric"]["required_dialect_groups"]
    } == {"group_gathering", "anchovy", "group_pull_request"}

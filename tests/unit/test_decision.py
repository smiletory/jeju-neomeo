import pytest

from app.decision import resolve_decision
from app.rubrics import get_rubric, load_hints
from app.schemas import CultureResult, DialectResult, VerificationResult


def test_pass_requires_all_three_layers() -> None:
    response = resolve_decision(
        culture=CultureResult(
            knowledge_pass=True,
            score=0.94,
            evidence_ids=["songdang_01"],
            confidence=0.95,
        ),
        dialect=DialectResult(
            dialect_pass=True,
            score=0.88,
            detected_feature_ids=["JEJ_ENDING_UDA"],
            confidence=0.91,
        ),
        verification=VerificationResult(
            verification_pass=True,
            conflict_detected=False,
            recommended_verdict="pass",
            confidence=0.93,
        ),
        rubric=get_rubric("gujwa_songdang_01", "1.0"),
        hints=load_hints(),
        trace_id="test-trace",
    )
    assert response.verdict == "pass"
    assert response.hint is None


def test_invalid_evidence_can_never_pass() -> None:
    response = resolve_decision(
        culture=CultureResult(
            knowledge_pass=True,
            score=0.99,
            evidence_ids=["invented_evidence"],
            confidence=0.99,
        ),
        dialect=DialectResult(
            dialect_pass=True,
            score=0.99,
            confidence=0.99,
        ),
        verification=VerificationResult(
            verification_pass=True,
            conflict_detected=False,
            recommended_verdict="pass",
            confidence=0.99,
        ),
        rubric=get_rubric("gujwa_songdang_01", "1.0"),
        hints=load_hints(),
        trace_id="test-trace",
    )
    assert response.verdict == "system_error"


def test_pass_requires_retrieved_culture_evidence() -> None:
    response = resolve_decision(
        culture=CultureResult(
            knowledge_pass=True,
            score=0.99,
            evidence_ids=[],
            confidence=0.99,
        ),
        dialect=DialectResult(
            dialect_pass=True,
            score=0.99,
            detected_feature_ids=["JEJ_ENDING_UDA"],
            confidence=0.99,
        ),
        verification=VerificationResult(
            verification_pass=True,
            conflict_detected=False,
            recommended_verdict="pass",
            confidence=0.99,
        ),
        rubric=get_rubric("gujwa_songdang_01", "1.0"),
        hints=load_hints(),
        trace_id="missing-grounding",
        allowed_evidence_ids={"songdang_01"},
        allowed_dialect_feature_ids={"JEJ_ENDING_UDA"},
    )

    assert response.verdict == "system_error"


def test_pass_requires_a_retrieved_dialect_feature() -> None:
    response = resolve_decision(
        culture=CultureResult(
            knowledge_pass=True,
            score=0.99,
            evidence_ids=["songdang_01"],
            confidence=0.99,
        ),
        dialect=DialectResult(
            dialect_pass=True,
            score=0.99,
            detected_feature_ids=["JEJ_ENDING_UDA"],
            confidence=0.99,
        ),
        verification=VerificationResult(
            verification_pass=True,
            conflict_detected=False,
            recommended_verdict="pass",
            confidence=0.99,
        ),
        rubric=get_rubric("gujwa_songdang_01", "1.0"),
        hints=load_hints(),
        trace_id="ungrounded-dialect",
        allowed_evidence_ids={"songdang_01"},
        allowed_dialect_feature_ids=set(),
    )

    assert response.verdict == "system_error"


def test_knowledge_pass_dialect_retry() -> None:
    response = resolve_decision(
        culture=CultureResult(
            knowledge_pass=True,
            score=0.95,
            evidence_ids=["songdang_01"],
            confidence=0.95,
        ),
        dialect=DialectResult(
            dialect_pass=False,
            score=0.35,
            standard_korean_only=True,
            confidence=0.96,
        ),
        verification=VerificationResult(
            verification_pass=True,
            conflict_detected=False,
            recommended_verdict="retry_dialect",
            hint_id="SONG_DIALECT_01",
            confidence=0.94,
        ),
        rubric=get_rubric("gujwa_songdang_01", "1.0"),
        hints=load_hints(),
        trace_id="test-trace",
    )
    assert response.verdict == "retry_dialect"
    assert response.hint_id == "SONG_DIALECT_01"


@pytest.mark.parametrize(
    "attempt,expected_hint_id",
    [
        (1, "INPUT_OFF_TOPIC_01"),
        (2, "INPUT_OFF_TOPIC_02"),
        (3, "INPUT_OFF_TOPIC_03"),
        (7, "INPUT_OFF_TOPIC_03"),
    ],
)
def test_off_topic_answer_uses_progressive_recovery_hints(
    attempt: int, expected_hint_id: str
) -> None:
    response = resolve_decision(
        culture=CultureResult(
            answer_relevance="off_topic",
            knowledge_pass=False,
            score=0.0,
            confidence=0.98,
        ),
        dialect=DialectResult(
            dialect_pass=True,
            score=0.9,
            detected_feature_ids=["JEJ_ENDING_UDA"],
            confidence=0.94,
        ),
        verification=VerificationResult(
            verification_pass=True,
            conflict_detected=False,
            recommended_verdict="retry_knowledge",
            confidence=0.95,
        ),
        rubric=get_rubric("gujwa_songdang_01", "1.0"),
        hints=load_hints(),
        trace_id="off-topic",
        attempt=attempt,
    )

    assert response.verdict == "retry_relevance"
    assert response.hint_id == expected_hint_id


def test_skipped_dialect_returns_meaning_retry_and_reports_stage() -> None:
    rubric = get_rubric("gujwa_songdang_01", "1.0")
    response = resolve_decision(
        culture=CultureResult(
            answer_relevance="off_topic",
            knowledge_pass=False,
            score=0.1,
            confidence=0.95,
        ),
        dialect=DialectResult(
            dialect_pass=False,
            evaluation_skipped=True,
            score=0.0,
            confidence=1.0,
        ),
        verification=VerificationResult(
            verification_pass=True,
            conflict_detected=False,
            recommended_verdict="retry_relevance",
            confidence=0.95,
        ),
        rubric=rubric,
        hints=load_hints(),
        trace_id="sequential-gate",
    )

    assert response.verdict == "retry_relevance"
    assert "dialect_skipped_due_to_meaning" in response.stages
    assert "아직 검사하지 않았습니다" in response.feedback_dialect


def test_practice_pass_requires_every_dialect_group() -> None:
    response = resolve_decision(
        culture=CultureResult(
            knowledge_pass=True,
            score=0.95,
            confidence=0.95,
        ),
        dialect=DialectResult(
            dialect_pass=True,
            score=0.9,
            matched_required_group_ids=["greeting_address"],
            confidence=0.95,
        ),
        verification=VerificationResult(
            verification_pass=True,
            conflict_detected=False,
            recommended_verdict="pass",
            confidence=0.95,
        ),
        rubric=get_rubric("gujwa_songdang_01", "1.0"),
        hints=load_hints(),
        trace_id="missing-required-group",
        required_dialect_group_ids={
            "greeting_address",
            "greeting_salutation",
        },
        requires_culture_evidence=False,
        allowed_evidence_ids=set(),
        allowed_dialect_feature_ids=set(),
    )

    assert response.verdict == "system_error"

from app.dialect_quality import (
    STANDARD_ENDING_FEEDBACK,
    enforce_dialect_quality,
)
from app.schemas import DialectResult


def test_isolated_jeju_word_cannot_mask_standard_formal_ending() -> None:
    result = enforce_dialect_quality(
        user_answer="마을사람들이 모영 기도를 드렸습니다.",
        dialect=DialectResult(
            dialect_pass=True,
            score=0.86,
            detected_feature_ids=["JEJ_CONNECT_YEONG"],
            confidence=0.93,
        ),
    )

    assert result.dialect_pass is False
    assert result.score == 0.49
    assert result.standard_korean_only is False
    assert STANDARD_ENDING_FEEDBACK in result.unsupported_expressions
    assert "JEJ_ENDING_UDA" in result.recommended_feature_ids


def test_grounded_jeju_sentence_ending_is_not_rejected() -> None:
    original = DialectResult(
        dialect_pass=True,
        score=0.91,
        detected_feature_ids=["JEJ_CONNECT_YEONG", "JEJ_ENDING_UDA"],
        confidence=0.94,
    )

    result = enforce_dialect_quality(
        user_answer="마을 사람들이 모영 안녕을 빌었수다.",
        dialect=original,
    )

    assert result is original
    assert result.dialect_pass is True

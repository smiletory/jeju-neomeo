"""Deterministic safeguards for whole-sentence Jeju dialect quality."""

from __future__ import annotations

import re

from app.schemas import DialectResult

STANDARD_FORMAL_ENDING = re.compile(r"(?:습니다|ㅂ니다|입니다)\s*[.!?…]*\s*$")
JEJU_FINAL_FEATURE_IDS = frozenset(
    {
        "JEJ_ENDING_UDA",
        "JEJ_POLITE_MARKER",
    }
)
STANDARD_ENDING_FEEDBACK = "표준어 종결형: -습니다/-ㅂ니다"


def enforce_dialect_quality(
    *,
    user_answer: str,
    dialect: DialectResult,
) -> DialectResult:
    """Reject a standard formal ending that is masked by isolated Jeju words.

    A retrieved word such as ``모영`` is still reported as a detected feature,
    but it cannot make the whole answer pass when the sentence itself ends in
    a standard Korean formal ending and has no grounded Jeju final expression.
    """

    detected_features = set(dialect.detected_feature_ids)
    has_standard_ending = bool(STANDARD_FORMAL_ENDING.search(user_answer))
    has_jeju_final = bool(detected_features & JEJU_FINAL_FEATURE_IDS)
    if not has_standard_ending or has_jeju_final:
        return dialect

    unsupported = list(dialect.unsupported_expressions)
    if STANDARD_ENDING_FEEDBACK not in unsupported:
        unsupported.append(STANDARD_ENDING_FEEDBACK)

    recommended = list(dialect.recommended_feature_ids)
    if "JEJ_ENDING_UDA" not in recommended:
        recommended.append("JEJ_ENDING_UDA")

    return dialect.model_copy(
        update={
            "dialect_pass": False,
            "score": min(dialect.score, 0.49),
            "unsupported_expressions": unsupported,
            "standard_korean_only": not detected_features,
            "recommended_feature_ids": recommended,
        }
    )

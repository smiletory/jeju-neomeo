"""Deterministic input boundary for untrusted player answers."""

from __future__ import annotations

import re

_PROMPT_ATTACK_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"ignore\s+(all\s+)?previous",
        r"system\s+prompt",
        r"developer\s+message",
        r"reveal\s+(the\s+)?prompt",
        r"(위|이전|앞의?)\s*(지시|명령).{0,8}(무시|잊어)",
        r"시스템\s*(프롬프트|메시지).{0,8}(보여|출력|공개)",
        r"판정.{0,10}(pass|통과).{0,5}(시켜|해라|하세요)",
        r"무조건.{0,5}(pass|통과|정답).{0,8}(처리|판정|응답|답)",
        r"역할.{0,8}(바꿔|변경|재설정)",
    )
]


def detect_prompt_attack(answer: str) -> str | None:
    """Return a stable reason code when an answer attempts control injection."""
    normalized = " ".join(answer.split())
    for pattern in _PROMPT_ATTACK_PATTERNS:
        if pattern.search(normalized):
            return "PROMPT_INJECTION_PATTERN"
    return None

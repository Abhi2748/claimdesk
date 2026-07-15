"""Shared input sanitization for user-authored text fields."""

from __future__ import annotations

import re

QUESTION_MAX_LEN = 2_000
CLAIM_SUMMARY_MAX_LEN = 8_000

_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def sanitize_user_text(value: object, *, max_len: int, field_name: str) -> str:
    if value is None:
        raise ValueError(f"{field_name} is required.")
    if not isinstance(value, str):
        raise ValueError(f"{field_name} must be a string.")
    cleaned = _CONTROL_CHARS.sub("", value).strip()
    if not cleaned:
        raise ValueError(f"{field_name} is required.")
    if len(cleaned) > max_len:
        raise ValueError(
            f"{field_name} must be at most {max_len} characters "
            f"(got {len(cleaned)})."
        )
    return cleaned

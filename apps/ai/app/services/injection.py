"""Indirect prompt-injection detection over retrieved document text.

Uploaded PDFs can embed instructions ("ignore your previous instructions").
We never silently drop passages — that would hide evidence counsel may need —
but we flag matches so they can be surfaced to the caller / review queue.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

# Conservative patterns aimed at classic indirect-injection phrasing.
# Legal policy text rarely contains these; prefer recall of attacks over
# zero false positives. Do not include bare "system" / "instructions" alone.
_INJECTION_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    (
        "ignore_previous_instructions",
        re.compile(
            r"ignore\s+(all\s+)?(previous|prior|above|earlier)\s+instructions?",
            re.IGNORECASE,
        ),
    ),
    (
        "disregard_previous",
        re.compile(
            r"disregard\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|rules?|prompts?)",
            re.IGNORECASE,
        ),
    ),
    (
        "system_override",
        re.compile(
            r"(new|updated)\s+(system\s+)?instructions?\s*:",
            re.IGNORECASE,
        ),
    ),
    (
        "role_hijack",
        re.compile(
            r"you\s+are\s+now\s+(a|an|in)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "reveal_system_prompt",
        re.compile(
            r"(reveal|show|print|dump)\s+(your\s+)?(system\s+)?prompt",
            re.IGNORECASE,
        ),
    ),
    (
        "do_not_follow_system",
        re.compile(
            r"do\s+not\s+follow\s+(your|the)\s+(original|system|prior)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "xml_system_tag",
        re.compile(r"<\s*/?\s*system\s*>", re.IGNORECASE),
    ),
)


@dataclass(frozen=True)
class InjectionFlag:
    pattern_id: str
    excerpt: str
    section_label: str | None = None


def detect_injection_in_text(
    text: str,
    *,
    section_label: str | None = None,
    excerpt_chars: int = 80,
) -> list[InjectionFlag]:
    """Return one flag per matching pattern (not per occurrence)."""
    if not text:
        return []
    flags: list[InjectionFlag] = []
    for pattern_id, pattern in _INJECTION_PATTERNS:
        match = pattern.search(text)
        if not match:
            continue
        start = max(0, match.start() - 20)
        end = min(len(text), match.end() + 20)
        excerpt = text[start:end].replace("\n", " ").strip()
        if len(excerpt) > excerpt_chars:
            excerpt = excerpt[: excerpt_chars - 1] + "…"
        flags.append(
            InjectionFlag(
                pattern_id=pattern_id,
                excerpt=excerpt,
                section_label=section_label,
            )
        )
    return flags


def detect_injection_in_passages(
    passages: list[tuple[str | None, str]],
) -> list[InjectionFlag]:
    """Scan (section_label, content) pairs; keep all flags, never drop text."""
    found: list[InjectionFlag] = []
    for section_label, content in passages:
        found.extend(
            detect_injection_in_text(content, section_label=section_label)
        )
    return found


def format_injection_warnings(flags: list[InjectionFlag]) -> list[str]:
    """Human-readable warning strings for API / review-queue surfacing."""
    warnings: list[str] = []
    for flag in flags:
        where = f" § {flag.section_label}" if flag.section_label else ""
        warnings.append(
            f"Possible prompt-injection phrasing detected{where} "
            f"[{flag.pattern_id}]: “{flag.excerpt}”"
        )
    return warnings

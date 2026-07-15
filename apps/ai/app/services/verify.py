"""Citation verifier — a faithful Python port of apps/web/lib/qa/verify.ts.
Structural check only: does each [LABEL, p.PAGE] marker in an answer
resolve to a real retrieved passage (section-label prefix match + page
overlap)? Stricter than the eval's invented-citation check (eval/scoring.ts
just checks the label exists anywhere in the document; this also requires
page agreement), so verified implies valid, not the reverse.

Parity with the TS original is enforced by tests/test_verify_parity.py
against a shared fixture (apps/web/eval/verify-parity-fixture.json,
generated from the real TS implementation). Do not change the regexes,
the prefix-matching rule, or the dedup key without regenerating the
fixture and re-validating parity — same discipline as bm25.py (ADR 007).
"""

import re
from typing import Literal

from pydantic import BaseModel

from app.schemas.qa import PolicyCitation

_SECTION_REF = re.compile(r"[IVX]+\.[A-Z](?:\.\d+)?(?:\.[a-z])?", re.IGNORECASE)
_MARKER = re.compile(r"\[([^\]]+)\]")
_PAGES = re.compile(r"pp?\.\s*(\d+)(?:\s*[-–]\s*(\d+))?", re.IGNORECASE)


class VerifiedCitation(BaseModel):
    marker: str
    label: str
    pages: list[int]
    status: Literal["verified", "unverified"]
    source: PolicyCitation | None = None


class VerificationResult(BaseModel):
    citations: list[VerifiedCitation]
    verified_count: int
    total_count: int
    all_verified: bool


def _section_prefixes(label: str) -> list[str]:
    token = label.strip().split()[0].upper() if label.strip() else ""
    if not token:
        return []
    segs = token.split(".")
    return [".".join(segs[:i]) for i in range(1, len(segs) + 1)]


def _parse_pages(inner: str) -> list[int]:
    m = _PAGES.search(inner)
    if not m:
        return []
    start = int(m.group(1))
    end = int(m.group(2)) if m.group(2) else start
    if end < start:
        return [start]
    return list(range(start, end + 1))


def _page_overlap(cited: list[int], chunk: PolicyCitation) -> bool:
    if not cited:
        return True
    if chunk.page_start is None:
        return True
    end = chunk.page_end if chunk.page_end is not None else chunk.page_start
    return any(chunk.page_start <= p <= end for p in cited)


def _label_matches(chunk_label: str, raw_label: str, roman_label: str | None) -> bool:
    if roman_label and roman_label in _section_prefixes(chunk_label):
        return True
    a = chunk_label.strip().lower()
    b = raw_label.strip().lower()
    return bool(b) and (a == b or a.startswith(b) or b.startswith(a))


def verify_citations(
    answer: str, retrieved_chunks: list[PolicyCitation]
) -> VerificationResult:
    """Verify each [LABEL, p.PAGE] citation in an answer against the
    passages actually retrieved and shown to the model.
    """
    seen: set[str] = set()
    citations: list[VerifiedCitation] = []

    for m in _MARKER.finditer(answer):
        marker = m.group(0)
        inner = m.group(1)
        raw_label = inner.split(",")[0].strip()
        section_match = _SECTION_REF.search(inner)
        roman_label = section_match.group(0).upper() if section_match else None
        has_page = _PAGES.search(inner) is not None
        if (not roman_label and not has_page) or not raw_label:
            continue

        pages = _parse_pages(inner)
        key = f"{raw_label.lower()}|{','.join(str(p) for p in pages)}"
        if key in seen:
            continue
        seen.add(key)

        source = next(
            (
                c
                for c in retrieved_chunks
                if _label_matches(c.section_label, raw_label, roman_label)
                and _page_overlap(pages, c)
            ),
            None,
        )
        citations.append(
            VerifiedCitation(
                marker=marker,
                label=roman_label or raw_label.upper(),
                pages=pages,
                status="verified" if source is not None else "unverified",
                source=source,
            )
        )

    verified_count = sum(1 for c in citations if c.status == "verified")
    return VerificationResult(
        citations=citations,
        verified_count=verified_count,
        total_count=len(citations),
        all_verified=len(citations) > 0 and verified_count == len(citations),
    )

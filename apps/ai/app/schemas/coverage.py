"""Coverage-agent output schemas (Block 2.5, ADR 009). Not wired to any
endpoint yet — defined in 2.5a so later sub-steps (draft_opinion's
tool-use schema, verify_and_score, write_review_queue) share one shape.
"""

from typing import Literal

from pydantic import BaseModel


class CoverageCitation(BaseModel):
    section_label: str
    document_id: str
    quoted_text: str


class CoverageFinding(BaseModel):
    type: Literal["coverage", "condition", "exclusion"]
    statement: str
    citation: CoverageCitation
    verified: bool
    grounding_score: float


class CoverageOpinion(BaseModel):
    matter_id: str
    claim_summary: str
    verdict: Literal["covered", "excluded", "partial", "unclear"]
    findings: list[CoverageFinding]
    overall_grounding_score: float
    model: str
    latency_ms: int
    generated_at: str

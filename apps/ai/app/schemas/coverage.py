"""Coverage-agent output schemas (Block 2.5, ADR 009). CoverageOpinion is the
final persisted shape (coverage_opinions table, migration 015). DraftOpinion/
DraftFinding is the narrower shape the draft_opinion node's Anthropic tool
call is allowed to produce — the model can't know verified/grounding_score
(those are computed by verify_and_score) or model/latency_ms/generated_at/
overall_grounding_score (assembled by write_review_queue), so it isn't given
a schema letting it guess at them.
"""

from typing import Literal

from pydantic import BaseModel


class CoverageCitation(BaseModel):
    section_label: str
    document_id: str
    quoted_text: str


class DraftFinding(BaseModel):
    type: Literal["coverage", "condition", "exclusion"]
    statement: str
    citation: CoverageCitation


class DraftOpinion(BaseModel):
    claim_summary: str
    verdict: Literal["covered", "excluded", "partial", "unclear"]
    findings: list[DraftFinding]


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

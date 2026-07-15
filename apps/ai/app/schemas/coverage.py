"""Coverage-agent output schemas (Block 2.5, ADR 009). CoverageOpinion is the
final persisted shape (coverage_opinions table, migration 015). DraftOpinion/
DraftFinding is the narrower shape the draft_opinion node's Anthropic tool
call is allowed to produce — the model can't know verified/grounding_score
(those are computed by verify_and_score) or model/latency_ms/generated_at/
overall_grounding_score (assembled by write_review_queue), so it isn't given
a schema letting it guess at them.
"""

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.services.input_limits import CLAIM_SUMMARY_MAX_LEN, sanitize_user_text


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


class CoverageAnalyzeRequest(BaseModel):
    case_id: str = Field(min_length=1, max_length=64)
    document_ids: list[str] = Field(min_length=1, max_length=50)
    claim_summary: str

    @field_validator("claim_summary", mode="before")
    @classmethod
    def _validate_claim_summary(cls, value: object) -> str:
        return sanitize_user_text(
            value, max_len=CLAIM_SUMMARY_MAX_LEN, field_name="claim_summary"
        )


class CoverageAnalyzeAcceptedResponse(BaseModel):
    status: Literal["accepted"]

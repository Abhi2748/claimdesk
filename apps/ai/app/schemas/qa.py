from pydantic import BaseModel, Field, field_validator

from app.services.input_limits import QUESTION_MAX_LEN, sanitize_user_text


class PolicyQARequest(BaseModel):
    document_id: str = Field(min_length=1, max_length=64)
    question: str

    @field_validator("question", mode="before")
    @classmethod
    def _validate_question(cls, value: object) -> str:
        return sanitize_user_text(
            value, max_len=QUESTION_MAX_LEN, field_name="question"
        )


class PolicyCitation(BaseModel):
    id: int
    section_label: str
    page_start: int | None
    page_end: int | None
    content: str
    similarity: float


class PolicyQAResponse(BaseModel):
    answer: str
    citations: list[PolicyCitation]
    retrieved_chunks: list[PolicyCitation]
    refused: bool
    top_similarity: float | None
    injection_warnings: list[str] = Field(default_factory=list)


class MatchChunkRow(BaseModel):
    id: int
    section_label: str | None = None
    page_start: int | None = None
    page_end: int | None = None
    content: str
    similarity: float


class PolicyPassage(BaseModel):
    index: int
    section_label: str
    page_start: int | None
    page_end: int | None
    content: str


class PolicyQAMatterRequest(BaseModel):
    document_ids: list[str] = Field(min_length=1, max_length=50)
    question: str

    @field_validator("question", mode="before")
    @classmethod
    def _validate_question(cls, value: object) -> str:
        return sanitize_user_text(
            value, max_len=QUESTION_MAX_LEN, field_name="question"
        )


class MatterCitation(PolicyCitation):
    document_id: str


class MatchChunkMultiRow(MatchChunkRow):
    document_id: str


class PolicyQAMatterResponse(BaseModel):
    answer: str
    citations: list[MatterCitation]
    retrieved_chunks: list[MatterCitation]
    refused: bool
    top_similarity: float | None
    injection_warnings: list[str] = Field(default_factory=list)

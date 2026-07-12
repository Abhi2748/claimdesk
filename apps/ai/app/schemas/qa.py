from pydantic import BaseModel


class PolicyQARequest(BaseModel):
    document_id: str
    question: str


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

from postgrest.exceptions import APIError
from supabase import Client

from app.constants import (
    QA_TOP_K,
    REFUSAL_MESSAGE,
    REFUSAL_SIMILARITY_THRESHOLD,
)
from app.observability import finish_retrieval_span, retrieval_span
from app.schemas.qa import (
    MatchChunkMultiRow,
    MatchChunkRow,
    MatterCitation,
    PolicyCitation,
    PolicyPassage,
    PolicyQAMatterResponse,
    PolicyQAResponse,
)
from app.services.anthropic import generate_policy_answer_from_passages
from app.services.embeddings import embed_query, embedding_to_vector


def _chunk_to_citation(chunk: MatchChunkRow) -> PolicyCitation:
    return PolicyCitation(
        id=chunk.id,
        section_label=chunk.section_label or "Section",
        page_start=chunk.page_start,
        page_end=chunk.page_end,
        content=chunk.content,
        similarity=chunk.similarity,
    )


def _multi_chunk_to_citation(chunk: MatchChunkMultiRow) -> MatterCitation:
    return MatterCitation(
        id=chunk.id,
        section_label=chunk.section_label or "Section",
        page_start=chunk.page_start,
        page_end=chunk.page_end,
        content=chunk.content,
        similarity=chunk.similarity,
        document_id=chunk.document_id,
    )


def answer_policy_question(
    supabase: Client, document_id: str, question: str
) -> PolicyQAResponse:
    trimmed = question.strip()
    if not trimmed:
        raise ValueError("Question is required.")

    with retrieval_span() as ret_span:
        query_embedding = embed_query(trimmed)

        try:
            response = supabase.rpc(
                "match_chunks",
                {
                    "query_embedding": embedding_to_vector(query_embedding),
                    "doc_id": document_id,
                    "match_count": QA_TOP_K,
                    "min_similarity": 0,
                },
            ).execute()
        except APIError as exc:
            raise RuntimeError(f"Search failed: {exc.message}") from exc

        if response.data is None:
            raise RuntimeError("Search failed: no data returned from match_chunks.")

        chunks = [MatchChunkRow.model_validate(row) for row in response.data]
        top_similarity = chunks[0].similarity if chunks else None
        retrieved_chunks = [_chunk_to_citation(chunk) for chunk in chunks]
        finish_retrieval_span(
            ret_span,
            chunk_count=len(chunks),
            top_similarity=top_similarity,
        )

    if not chunks or (chunks[0].similarity if chunks else 0) < REFUSAL_SIMILARITY_THRESHOLD:
        return PolicyQAResponse(
            answer=REFUSAL_MESSAGE,
            citations=[],
            retrieved_chunks=retrieved_chunks,
            refused=True,
            top_similarity=top_similarity,
        )

    citations = retrieved_chunks
    passages = [
        PolicyPassage(
            index=i + 1,
            section_label=citation.section_label,
            page_start=citation.page_start,
            page_end=citation.page_end,
            content=citation.content,
        )
        for i, citation in enumerate(citations)
    ]

    answer = generate_policy_answer_from_passages(trimmed, passages)
    refused = answer == REFUSAL_MESSAGE

    return PolicyQAResponse(
        answer=answer,
        citations=[] if refused else citations,
        retrieved_chunks=retrieved_chunks,
        refused=refused,
        top_similarity=top_similarity,
    )


def answer_matter_question(
    supabase: Client, document_ids: list[str], question: str
) -> PolicyQAMatterResponse:
    trimmed = question.strip()
    if not trimmed:
        raise ValueError("Question is required.")

    if not document_ids:
        return PolicyQAMatterResponse(
            answer=REFUSAL_MESSAGE,
            citations=[],
            retrieved_chunks=[],
            refused=True,
            top_similarity=None,
        )

    with retrieval_span() as ret_span:
        query_embedding = embed_query(trimmed)

        try:
            response = supabase.rpc(
                "match_chunks_multi",
                {
                    "query_embedding": embedding_to_vector(query_embedding),
                    "doc_ids": document_ids,
                    "match_count": QA_TOP_K,
                    "min_similarity": 0,
                },
            ).execute()
        except APIError as exc:
            raise RuntimeError(f"Search failed: {exc.message}") from exc

        if response.data is None:
            raise RuntimeError(
                "Search failed: no data returned from match_chunks_multi."
            )

        chunks = [MatchChunkMultiRow.model_validate(row) for row in response.data]
        top_similarity = chunks[0].similarity if chunks else None
        retrieved_chunks = [_multi_chunk_to_citation(chunk) for chunk in chunks]
        finish_retrieval_span(
            ret_span,
            chunk_count=len(chunks),
            top_similarity=top_similarity,
        )

    if not chunks or (chunks[0].similarity if chunks else 0) < REFUSAL_SIMILARITY_THRESHOLD:
        return PolicyQAMatterResponse(
            answer=REFUSAL_MESSAGE,
            citations=[],
            retrieved_chunks=retrieved_chunks,
            refused=True,
            top_similarity=top_similarity,
        )

    citations = retrieved_chunks
    passages = [
        PolicyPassage(
            index=i + 1,
            section_label=citation.section_label,
            page_start=citation.page_start,
            page_end=citation.page_end,
            content=citation.content,
        )
        for i, citation in enumerate(citations)
    ]

    answer = generate_policy_answer_from_passages(trimmed, passages)
    refused = answer == REFUSAL_MESSAGE

    return PolicyQAMatterResponse(
        answer=answer,
        citations=[] if refused else citations,
        retrieved_chunks=retrieved_chunks,
        refused=refused,
        top_similarity=top_similarity,
    )

from postgrest.exceptions import APIError
from supabase import Client

from app.constants import (
    MATTER_QA_POOL,
    MATTER_QA_TOP_K,
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
from app.services.bm25 import BM25Chunk, BM25Index, reciprocal_rank_fusion
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


def retrieve_hybrid(
    supabase: Client,
    document_ids: list[str],
    query: str,
    top_k: int,
    pool: int,
) -> tuple[list[MatterCitation], float | None]:
    """Hybrid (dense + BM25, RRF-fused) retrieval, per ADR 003/004/007.
    Extracted from answer_matter_question in Block 2.5a (ADR 009) so the
    coverage agent's retrieve node can share it — zero behavior change,
    same dense/BM25/fusion calls, now parameterized by top_k/pool instead
    of hardcoded to MATTER_QA_TOP_K/MATTER_QA_POOL.
    """
    query_embedding = embed_query(query)

    try:
        dense_response = supabase.rpc(
            "match_chunks_multi",
            {
                "query_embedding": embedding_to_vector(query_embedding),
                "doc_ids": document_ids,
                "match_count": pool,
                "min_similarity": 0,
            },
        ).execute()
    except APIError as exc:
        raise RuntimeError(f"Search failed: {exc.message}") from exc

    if dense_response.data is None:
        raise RuntimeError("Search failed: no data returned from match_chunks_multi.")

    dense_chunks = [
        MatchChunkMultiRow.model_validate(row) for row in dense_response.data
    ]
    top_similarity = dense_chunks[0].similarity if dense_chunks else None

    try:
        bm25_response = (
            supabase.table("chunks")
            .select("id, section_label, page_start, page_end, content, document_id")
            .in_("document_id", document_ids)
            .execute()
        )
    except APIError as exc:
        raise RuntimeError(f"BM25 chunk fetch failed: {exc.message}") from exc

    bm25_rows = bm25_response.data or []
    bm25_row_by_id = {row["id"]: row for row in bm25_rows}
    bm25_index = BM25Index(
        [BM25Chunk(id=row["id"], content=row["content"]) for row in bm25_rows]
    )
    bm25_results = bm25_index.search(query, pool)

    dense_by_id = {chunk.id: chunk for chunk in dense_chunks}
    fused = reciprocal_rank_fusion(
        [
            [chunk.id for chunk in dense_chunks],
            [r["id"] for r in bm25_results],
        ]
    )

    retrieved_chunks: list[MatterCitation] = []
    for item in fused[:top_k]:
        dense_chunk = dense_by_id.get(item["id"])
        if dense_chunk is not None:
            retrieved_chunks.append(_multi_chunk_to_citation(dense_chunk))
            continue
        row = bm25_row_by_id.get(item["id"])
        if row is None:
            continue
        retrieved_chunks.append(
            MatterCitation(
                id=row["id"],
                section_label=row.get("section_label") or "Section",
                page_start=row.get("page_start"),
                page_end=row.get("page_end"),
                content=row["content"],
                similarity=0.0,
                document_id=row["document_id"],
            )
        )

    return retrieved_chunks, top_similarity


def answer_matter_question(
    supabase: Client, document_ids: list[str], question: str
) -> PolicyQAMatterResponse:
    """Live "Ask the matter" path. Hybrid retrieval (dense + BM25, RRF-fused)
    at MATTER_QA_TOP_K=10, per ADR 004/007 — ships only here, not to
    answer_policy_question, which nothing live calls today (see ADR 007).
    The refusal gate stays on the dense pool's top-1 similarity, matching
    ADR 003/004's calibration; BM25/fusion never affects the refusal
    decision, only which passages get sent to the answerer once retrieval
    has already decided not to refuse.
    """
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
        retrieved_chunks, top_similarity = retrieve_hybrid(
            supabase, document_ids, trimmed, MATTER_QA_TOP_K, MATTER_QA_POOL
        )
        finish_retrieval_span(
            ret_span,
            chunk_count=len(retrieved_chunks),
            top_similarity=top_similarity,
        )

    if top_similarity is None or top_similarity < REFUSAL_SIMILARITY_THRESHOLD:
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

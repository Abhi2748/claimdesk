"""The coverage agent (Block 2.5, ADR 009): a 4-node LangGraph pipeline
producing a structured, cited coverage opinion for a claim.

    retrieve -> draft_opinion -> verify_and_score -> write_review_queue

Each node is documented in ADR 009 along with what was deliberately left
out (no query-decomposition, no LLM-as-judge grounding, no retry loop, no
routing node) and why. Not wired to an HTTP endpoint yet — that's Block
2.5d, along with per-node Langfuse tracing.

The supabase client is captured via closure when the graph is built
(build_coverage_graph), not carried in graph state — state stays plain,
JSON-shaped data so a future persistent checkpointer isn't fighting a
non-serializable client object; the in-memory checkpointer used here
doesn't need that today, but there's no reason to paint into that corner.
"""

import time
from datetime import datetime, timezone
from typing import TypedDict

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph
from postgrest.exceptions import APIError
from supabase import Client

from app.constants import (
    ANTHROPIC_MODEL,
    COVERAGE_RETRIEVE_POOL,
    COVERAGE_RETRIEVE_TOP_K,
)
from app.schemas.coverage import CoverageFinding, CoverageOpinion
from app.schemas.qa import MatterCitation
from app.services.anthropic import draft_coverage_opinion
from app.services.embeddings import cosine_similarity, embed_query, vector_from_string
from app.services.qa_pipeline import retrieve_hybrid
from app.services.verify import find_citation_source


class CoverageAgentState(TypedDict, total=False):
    case_id: str
    document_ids: list[str]
    claim_summary: str

    retrieved_chunks: list[MatterCitation]
    draft_verdict: str
    draft_claim_summary: str
    draft_findings: list[dict]  # DraftFinding.model_dump() each

    findings: list[CoverageFinding]
    overall_grounding_score: float

    coverage_opinion_id: str
    review_item_id: str


def _retrieve_node(supabase: Client):
    def node(state: CoverageAgentState) -> dict:
        retrieved_chunks, _top_similarity = retrieve_hybrid(
            supabase,
            state["document_ids"],
            state["claim_summary"],
            COVERAGE_RETRIEVE_TOP_K,
            COVERAGE_RETRIEVE_POOL,
        )
        return {"retrieved_chunks": retrieved_chunks}

    return node


def _draft_opinion_node(state: CoverageAgentState) -> dict:
    draft = draft_coverage_opinion(state["claim_summary"], state["retrieved_chunks"])
    return {
        "draft_verdict": draft.verdict,
        "draft_claim_summary": draft.claim_summary,
        "draft_findings": [f.model_dump() for f in draft.findings],
    }


def _verify_and_score_node(supabase: Client):
    def node(state: CoverageAgentState) -> dict:
        retrieved_chunks: list[MatterCitation] = state["retrieved_chunks"]

        # Resolve each finding's source chunk first (cheap, no I/O), scoped
        # to the cited document — a matter can hold several documents, and
        # the same section-label numbering could otherwise false-match
        # across them.
        sources: list[MatterCitation | None] = []
        for raw in state["draft_findings"]:
            citation = raw["citation"]
            same_doc = [
                c for c in retrieved_chunks if c.document_id == citation["document_id"]
            ]
            sources.append(find_citation_source(citation["section_label"], same_doc))

        # Batch-fetch stored embeddings for every verified finding's source
        # chunk in one query — reuses ingest-time embeddings (ADR 009: "no
        # new API call" for the chunk side of the comparison).
        source_ids = sorted({s.id for s in sources if s is not None})
        embedding_by_id: dict[int, list[float]] = {}
        if source_ids:
            try:
                resp = (
                    supabase.table("chunks")
                    .select("id, embedding")
                    .in_("id", source_ids)
                    .execute()
                )
            except APIError as exc:
                raise RuntimeError(f"Chunk embedding fetch failed: {exc.message}") from exc
            for row in resp.data or []:
                if row.get("embedding") is not None:
                    embedding_by_id[row["id"]] = vector_from_string(row["embedding"])

        findings: list[CoverageFinding] = []
        for raw, source in zip(state["draft_findings"], sources):
            verified = source is not None
            grounding_score = 0.0
            if verified and source.id in embedding_by_id:
                statement_embedding = embed_query(raw["statement"])
                grounding_score = cosine_similarity(
                    statement_embedding, embedding_by_id[source.id]
                )
            findings.append(
                CoverageFinding(
                    type=raw["type"],
                    statement=raw["statement"],
                    citation=raw["citation"],
                    verified=verified,
                    grounding_score=grounding_score,
                )
            )

        # Weakest-link, not average (ADR 009): one badly-grounded exclusion
        # shouldn't be masked by several well-grounded coverage findings.
        overall = min((f.grounding_score for f in findings), default=0.0)
        return {"findings": findings, "overall_grounding_score": overall}

    return node


def _write_review_queue_node(supabase: Client, start_time: float):
    def node(state: CoverageAgentState) -> dict:
        latency_ms = int((time.monotonic() - start_time) * 1000)
        findings_json = [f.model_dump() for f in state["findings"]]

        try:
            opinion_resp = (
                supabase.table("coverage_opinions")
                .insert(
                    {
                        "case_id": state["case_id"],
                        "document_ids": state["document_ids"],
                        "claim_summary": state["draft_claim_summary"],
                        "verdict": state["draft_verdict"],
                        "findings": findings_json,
                        "overall_grounding_score": state["overall_grounding_score"],
                        "model": ANTHROPIC_MODEL,
                        "latency_ms": latency_ms,
                    }
                )
                .execute()
            )
        except APIError as exc:
            raise RuntimeError(f"coverage_opinions insert failed: {exc.message}") from exc
        if not opinion_resp.data:
            raise RuntimeError("coverage_opinions insert returned no row.")
        opinion_id = opinion_resp.data[0]["id"]

        unverified_count = sum(1 for f in state["findings"] if not f.verified)
        summary = (
            f"Verdict: {state['draft_verdict']}. {len(state['findings'])} finding(s), "
            f"{unverified_count} unverified. Overall grounding "
            f"{state['overall_grounding_score']:.2f}."
        )
        try:
            review_resp = (
                supabase.table("review_items")
                .insert(
                    {
                        "case_id": state["case_id"],
                        "kind": "coverage_analysis",
                        "ref_id": opinion_id,
                        "title": f"Coverage opinion: {state['draft_verdict']}",
                        "summary": summary,
                    }
                )
                .execute()
            )
        except APIError as exc:
            raise RuntimeError(f"review_items insert failed: {exc.message}") from exc
        if not review_resp.data:
            raise RuntimeError("review_items insert returned no row.")
        review_item_id = review_resp.data[0]["id"]

        return {
            "coverage_opinion_id": opinion_id,
            "review_item_id": review_item_id,
        }

    return node


def build_coverage_graph(supabase: Client, start_time: float):
    graph = StateGraph(CoverageAgentState)
    graph.add_node("retrieve", _retrieve_node(supabase))
    graph.add_node("draft_opinion", _draft_opinion_node)
    graph.add_node("verify_and_score", _verify_and_score_node(supabase))
    graph.add_node("write_review_queue", _write_review_queue_node(supabase, start_time))

    graph.set_entry_point("retrieve")
    graph.add_edge("retrieve", "draft_opinion")
    graph.add_edge("draft_opinion", "verify_and_score")
    graph.add_edge("verify_and_score", "write_review_queue")
    graph.add_edge("write_review_queue", END)

    return graph.compile(checkpointer=MemorySaver())


def run_coverage_agent(
    supabase: Client, case_id: str, document_ids: list[str], claim_summary: str
) -> CoverageOpinion:
    start_time = time.monotonic()
    app = build_coverage_graph(supabase, start_time)
    config = {"configurable": {"thread_id": f"coverage-{case_id}-{start_time}"}}
    result = app.invoke(
        {
            "case_id": case_id,
            "document_ids": document_ids,
            "claim_summary": claim_summary,
        },
        config=config,
    )

    return CoverageOpinion(
        matter_id=case_id,
        claim_summary=result["draft_claim_summary"],
        verdict=result["draft_verdict"],
        findings=result["findings"],
        overall_grounding_score=result["overall_grounding_score"],
        model=ANTHROPIC_MODEL,
        latency_ms=int((time.monotonic() - start_time) * 1000),
        generated_at=datetime.now(timezone.utc).isoformat(),
    )

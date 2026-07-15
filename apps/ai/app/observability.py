"""Optional Langfuse tracing (v4 OTEL SDK). Fail-open when disabled or on error."""

from __future__ import annotations

import base64
import json
import logging
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any, Generator

from langfuse import Langfuse, propagate_attributes

logger = logging.getLogger(__name__)


@dataclass
class ObservabilityState:
    enabled: bool = False
    client: Langfuse | None = None
    host: str = "https://cloud.langfuse.com"


_state = ObservabilityState()


def get_observability() -> ObservabilityState:
    return _state


def init_observability(
    *,
    public_key: str | None,
    secret_key: str | None,
    host: str = "https://cloud.langfuse.com",
) -> ObservabilityState:
    global _state

    if not public_key or not secret_key:
        logger.debug("Langfuse tracing disabled: missing public or secret key")
        _state = ObservabilityState(enabled=False, client=None, host=host)
        return _state

    try:
        client = Langfuse(
            public_key=public_key,
            secret_key=secret_key,
            host=host,
        )
        _state = ObservabilityState(enabled=True, client=client, host=host)
        logger.debug("Langfuse tracing enabled")
    except Exception:
        logger.debug("Langfuse initialization failed", exc_info=True)
        _state = ObservabilityState(enabled=False, client=None, host=host)

    return _state


def flush_traces() -> None:
    if _state.client is None:
        return
    try:
        _state.client.flush()
    except Exception:
        logger.debug("Langfuse flush failed", exc_info=True)


def shutdown_observability() -> None:
    flush_traces()


def user_id_from_access_token(access_token: str) -> str | None:
    try:
        payload_segment = access_token.split(".")[1]
        padded = payload_segment + "=" * (-len(payload_segment) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded))
        sub = payload.get("sub")
        return sub if isinstance(sub, str) and sub else None
    except Exception:
        logger.debug("Could not decode user id from access token", exc_info=True)
        return None


def trace_dashboard_url(trace_id: str) -> str:
    return f"{_state.host.rstrip('/')}/trace/{trace_id}"


@contextmanager
def policy_qa_trace(
    *,
    question: str,
    document_id: str,
    user_id: str | None,
) -> Generator[Any | None, None, None]:
    if not _state.enabled or _state.client is None:
        yield None
        return

    try:
        with propagate_attributes(user_id=user_id):
            with _state.client.start_as_current_observation(
                name="policy_qa",
                as_type="span",
                input=question,
                metadata={"document_id": document_id},
            ) as span:
                yield span
    except Exception:
        logger.debug("Langfuse policy_qa trace failed", exc_info=True)
        yield None


def finish_policy_qa_trace(
    span: Any | None,
    *,
    answer: str,
    refused: bool,
    top_similarity: float | None,
    document_id: str,
) -> None:
    if span is None:
        return
    try:
        span.update(
            output=answer,
            metadata={
                "refused": refused,
                "top_similarity": top_similarity,
                "document_id": document_id,
            },
        )
        trace_id = getattr(span, "trace_id", None)
        if trace_id:
            logger.debug("Langfuse trace: %s", trace_dashboard_url(trace_id))
    except Exception:
        logger.debug("Langfuse policy_qa trace update failed", exc_info=True)


@contextmanager
def matter_qa_trace(
    *,
    question: str,
    document_ids: list[str],
    user_id: str | None,
) -> Generator[Any | None, None, None]:
    if not _state.enabled or _state.client is None:
        yield None
        return

    try:
        with propagate_attributes(user_id=user_id):
            with _state.client.start_as_current_observation(
                name="matter_qa",
                as_type="span",
                input=question,
                metadata={
                    "document_ids": document_ids,
                    "doc_count": len(document_ids),
                },
            ) as span:
                yield span
    except Exception:
        logger.debug("Langfuse matter_qa trace failed", exc_info=True)
        yield None


def finish_matter_qa_trace(
    span: Any | None,
    *,
    answer: str,
    refused: bool,
    top_similarity: float | None,
    document_ids: list[str],
) -> None:
    if span is None:
        return
    try:
        span.update(
            output=answer,
            metadata={
                "refused": refused,
                "top_similarity": top_similarity,
                "document_ids": document_ids,
                "doc_count": len(document_ids),
            },
        )
        trace_id = getattr(span, "trace_id", None)
        if trace_id:
            logger.debug("Langfuse trace: %s", trace_dashboard_url(trace_id))
    except Exception:
        logger.debug("Langfuse matter_qa trace update failed", exc_info=True)


@contextmanager
def coverage_agent_trace(
    *,
    claim_summary: str,
    case_id: str,
    document_ids: list[str],
    user_id: str | None,
) -> Generator[Any | None, None, None]:
    """Top-level span for one coverage-agent run (Block 2.5d). Entered
    around the whole graph invocation (app/services/coverage_agent.py's
    run_coverage_agent), so the per-node spans below — retrieval_span
    (reused as-is) and the two new ones — nest under it via Langfuse's
    ambient current-observation context, the same mechanism matter_qa_trace
    already relies on for retrieval_span/claude_generation_span.
    """
    if not _state.enabled or _state.client is None:
        yield None
        return

    try:
        with propagate_attributes(user_id=user_id):
            with _state.client.start_as_current_observation(
                name="coverage_agent",
                as_type="span",
                input=claim_summary,
                metadata={"case_id": case_id, "document_ids": document_ids},
            ) as span:
                yield span
    except Exception:
        logger.debug("Langfuse coverage_agent trace failed", exc_info=True)
        yield None


def finish_coverage_agent_trace(
    span: Any | None,
    *,
    verdict: str | None,
    overall_grounding_score: float | None,
    finding_count: int,
    unverified_count: int,
    latency_ms: int,
    error: str | None = None,
) -> None:
    if span is None:
        return
    try:
        span.update(
            output=verdict,
            metadata={
                "overall_grounding_score": overall_grounding_score,
                "finding_count": finding_count,
                "unverified_count": unverified_count,
                "latency_ms": latency_ms,
                "error": error,
            },
        )
        trace_id = getattr(span, "trace_id", None)
        if trace_id:
            logger.debug("Langfuse trace: %s", trace_dashboard_url(trace_id))
    except Exception:
        logger.debug("Langfuse coverage_agent trace update failed", exc_info=True)


@contextmanager
def verify_and_score_span() -> Generator[Any | None, None, None]:
    if not _state.enabled or _state.client is None:
        yield None
        return

    try:
        with _state.client.start_as_current_observation(
            name="verify_and_score",
            as_type="span",
        ) as span:
            yield span
    except Exception:
        logger.debug("Langfuse verify_and_score span failed", exc_info=True)
        yield None


def finish_verify_and_score_span(
    span: Any | None,
    *,
    verified_count: int,
    unverified_count: int,
    overall_grounding_score: float,
    embedding_calls: int,
) -> None:
    if span is None:
        return
    try:
        span.update(
            metadata={
                "verified_count": verified_count,
                "unverified_count": unverified_count,
                "overall_grounding_score": overall_grounding_score,
                "embedding_calls": embedding_calls,
            }
        )
    except Exception:
        logger.debug("Langfuse verify_and_score span update failed", exc_info=True)


@contextmanager
def write_review_queue_span() -> Generator[Any | None, None, None]:
    if not _state.enabled or _state.client is None:
        yield None
        return

    try:
        with _state.client.start_as_current_observation(
            name="write_review_queue",
            as_type="span",
        ) as span:
            yield span
    except Exception:
        logger.debug("Langfuse write_review_queue span failed", exc_info=True)
        yield None


def finish_write_review_queue_span(
    span: Any | None,
    *,
    coverage_opinion_id: str,
    review_item_id: str,
) -> None:
    if span is None:
        return
    try:
        span.update(
            metadata={
                "coverage_opinion_id": coverage_opinion_id,
                "review_item_id": review_item_id,
            }
        )
    except Exception:
        logger.debug("Langfuse write_review_queue span update failed", exc_info=True)


@contextmanager
def retrieval_span() -> Generator[Any | None, None, None]:
    if not _state.enabled or _state.client is None:
        yield None
        return

    try:
        with _state.client.start_as_current_observation(
            name="retrieval",
            as_type="retriever",
        ) as span:
            yield span
    except Exception:
        logger.debug("Langfuse retrieval span failed", exc_info=True)
        yield None


def finish_retrieval_span(
    span: Any | None,
    *,
    chunk_count: int,
    top_similarity: float | None,
) -> None:
    if span is None:
        return
    try:
        span.update(
            metadata={
                "chunk_count": chunk_count,
                "top_similarity": top_similarity,
            }
        )
    except Exception:
        logger.debug("Langfuse retrieval span update failed", exc_info=True)


@contextmanager
def claude_generation_span(
    *,
    model: str,
    generation_input: Any,
) -> Generator[Any | None, None, None]:
    if not _state.enabled or _state.client is None:
        yield None
        return

    try:
        with _state.client.start_as_current_observation(
            name="claude_answer",
            as_type="generation",
            model=model,
            input=generation_input,
        ) as span:
            yield span
    except Exception:
        logger.debug("Langfuse Claude generation span failed", exc_info=True)
        yield None


def finish_claude_generation_span(
    span: Any | None,
    *,
    output: str,
    usage_details: dict[str, int] | None,
) -> None:
    if span is None:
        return
    try:
        span.update(output=output, usage_details=usage_details)
    except Exception:
        logger.debug("Langfuse Claude generation update failed", exc_info=True)

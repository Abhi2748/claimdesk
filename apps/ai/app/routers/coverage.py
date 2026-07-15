"""POST /coverage/analyze (Block 2.5d) — triggers the coverage agent
(app/services/coverage_agent.py) as a background job. ADR 009 established
this must not block the request: a single opinion runs ~20-30s (measured
25.5s live in Block 2.5c), well past what a synchronous HTTP response
should hold open. The endpoint returns 202 immediately; the result appears
in the review queue (review_items, kind='coverage_analysis') once the job
finishes — the client polls that, same as any other review-queue item.

Uses FastAPI's built-in BackgroundTasks, not a separate task queue: this
runs in the same worker process/request lifecycle, no new infra, matching
this service's existing two-service-monorepo simplicity. If Render's single
worker becomes a real bottleneck under concurrent opinion requests, that's
the signal to revisit — not something to build ahead of evidence for.
"""

import logging

from fastapi import APIRouter, BackgroundTasks, Depends

from app.deps import get_access_token
from app.observability import user_id_from_access_token
from app.schemas.coverage import CoverageAnalyzeAcceptedResponse, CoverageAnalyzeRequest
from app.services.coverage_agent import record_coverage_failure, run_coverage_agent
from app.services.supabase_client import create_user_supabase_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/coverage", tags=["coverage"])


def _run_and_log(
    access_token: str,
    case_id: str,
    document_ids: list[str],
    claim_summary: str,
    user_id: str | None,
) -> None:
    # Runs after the response is sent — nothing is listening for a return
    # value or a raised exception here. run_coverage_agent already records
    # failures to the Langfuse trace before re-raising; this is a second,
    # independent safety net so a failure is never silent even if tracing
    # itself is disabled or erroring (fail-open, same posture as
    # observability.py throughout). ADR 011 also persists a review_items
    # failure row so the attorney sees the miss in /review.
    supabase = create_user_supabase_client(access_token)
    try:
        run_coverage_agent(supabase, case_id, document_ids, claim_summary, user_id)
    except Exception as exc:
        logger.error(
            "Coverage agent run failed for case_id=%s", case_id, exc_info=True
        )
        record_coverage_failure(
            supabase,
            case_id=case_id,
            claim_summary=claim_summary,
            error_message=str(exc),
        )


@router.post("/analyze", response_model=CoverageAnalyzeAcceptedResponse, status_code=202)
def coverage_analyze(
    body: CoverageAnalyzeRequest,
    background_tasks: BackgroundTasks,
    access_token: str = Depends(get_access_token),
) -> CoverageAnalyzeAcceptedResponse:
    user_id = user_id_from_access_token(access_token)
    background_tasks.add_task(
        _run_and_log,
        access_token,
        body.case_id,
        body.document_ids,
        body.claim_summary,
        user_id,
    )
    return CoverageAnalyzeAcceptedResponse(status="accepted")

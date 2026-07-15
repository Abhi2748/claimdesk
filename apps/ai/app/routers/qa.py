from fastapi import APIRouter, Depends, HTTPException

from app.deps import get_access_token
from app.observability import (
    finish_matter_qa_trace,
    finish_policy_qa_trace,
    flush_traces,
    matter_qa_trace,
    policy_qa_trace,
    user_id_from_access_token,
)
from app.schemas.qa import (
    PolicyQAMatterRequest,
    PolicyQAMatterResponse,
    PolicyQARequest,
    PolicyQAResponse,
)
from app.services.qa_pipeline import answer_matter_question, answer_policy_question
from app.services.supabase_client import create_user_supabase_client

router = APIRouter(prefix="/qa", tags=["qa"])


@router.post("/answer", response_model=PolicyQAResponse)
def qa_answer(
    body: PolicyQARequest,
    access_token: str = Depends(get_access_token),
) -> PolicyQAResponse:
    supabase = create_user_supabase_client(access_token)
    user_id = user_id_from_access_token(access_token)

    with policy_qa_trace(
        question=body.question,
        document_id=body.document_id,
        user_id=user_id,
    ) as trace_span:
        try:
            result = answer_policy_question(
                supabase, body.document_id, body.question
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except RuntimeError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

        finish_policy_qa_trace(
            trace_span,
            answer=result.answer,
            refused=result.refused,
            top_similarity=result.top_similarity,
            document_id=body.document_id,
        )
        flush_traces()
        return result


@router.post("/matter", response_model=PolicyQAMatterResponse)
def qa_matter(
    body: PolicyQAMatterRequest,
    access_token: str = Depends(get_access_token),
) -> PolicyQAMatterResponse:
    supabase = create_user_supabase_client(access_token)
    user_id = user_id_from_access_token(access_token)

    with matter_qa_trace(
        question=body.question,
        document_ids=body.document_ids,
        user_id=user_id,
    ) as trace_span:
        try:
            result = answer_matter_question(
                supabase, body.document_ids, body.question
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except RuntimeError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

        finish_matter_qa_trace(
            trace_span,
            answer=result.answer,
            refused=result.refused,
            top_similarity=result.top_similarity,
            document_ids=body.document_ids,
        )
        flush_traces()
        return result

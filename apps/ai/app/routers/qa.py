from fastapi import APIRouter, Depends, Header, HTTPException

from app.observability import (
    finish_policy_qa_trace,
    flush_traces,
    policy_qa_trace,
    user_id_from_access_token,
)
from app.schemas.qa import PolicyQARequest, PolicyQAResponse
from app.services.qa_pipeline import answer_policy_question
from app.services.supabase_client import create_user_supabase_client

router = APIRouter(prefix="/qa", tags=["qa"])


def get_access_token(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Authorization header must be Bearer <token>.",
        )
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Bearer token is required.")
    return token


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

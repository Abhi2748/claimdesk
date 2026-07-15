"""Shared FastAPI dependencies. get_access_token moved here in Block 2.5d
so /coverage/analyze can forward the user's JWT the same way /qa/matter
does (app/routers/qa.py originally), rather than reimplementing it.
"""

from fastapi import Header, HTTPException


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

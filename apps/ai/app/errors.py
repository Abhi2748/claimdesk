"""Structured HTTP error responses — user-safe messages, no stack traces."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


class ErrorBody(BaseModel):
    code: str
    message: str
    details: list[str] = Field(default_factory=list)


def error_response(
    status_code: int,
    *,
    code: str,
    message: str,
    details: list[str] | None = None,
) -> JSONResponse:
    body = ErrorBody(code=code, message=message, details=details or [])
    return JSONResponse(status_code=status_code, content={"detail": body.model_dump()})


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def validation_handler(
        _request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        details: list[str] = []
        for err in exc.errors():
            loc = ".".join(str(part) for part in err.get("loc", ()) if part != "body")
            msg = err.get("msg", "Invalid value")
            details.append(f"{loc}: {msg}" if loc else msg)
        return error_response(
            422,
            code="validation_error",
            message="That input isn't valid. Please shorten or rephrase and try again.",
            details=details[:8],
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(
        _request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        raw = exc.detail
        if isinstance(raw, dict) and "code" in raw and "message" in raw:
            return JSONResponse(status_code=exc.status_code, content={"detail": raw})
        message = raw if isinstance(raw, str) else _default_message(exc.status_code)
        code = _code_for_status(exc.status_code)
        return error_response(exc.status_code, code=code, message=message)

    @app.exception_handler(Exception)
    async def unhandled_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return error_response(
            500,
            code="internal_error",
            message="Something went wrong on our side. Please try again.",
        )


def _code_for_status(status: int) -> str:
    return {
        400: "bad_request",
        401: "unauthorized",
        403: "forbidden",
        404: "not_found",
        408: "timeout",
        422: "validation_error",
        502: "upstream_error",
        503: "unavailable",
        504: "timeout",
    }.get(status, "http_error")


def _default_message(status: int) -> str:
    return {
        400: "That request isn't valid.",
        401: "You must be signed in.",
        403: "You don't have access to do that.",
        404: "Not found.",
        408: "The request timed out. Please try again.",
        502: "A dependent service failed. Please try again.",
        503: "The service is temporarily unavailable.",
        504: "The request timed out. Please try again.",
    }.get(status, "Something went wrong. Please try again.")


def http_detail(code: str, message: str, details: list[str] | None = None) -> dict[str, Any]:
    """Build a dict suitable for HTTPException(detail=...)."""
    return ErrorBody(code=code, message=message, details=details or []).model_dump()

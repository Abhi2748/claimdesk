import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.observability import init_observability, shutdown_observability
from app.routers import coverage, health, qa


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Allow /health without secrets (e.g. container health checks).
    # QA routes still require full settings when invoked.
    try:
        settings = get_settings()
        init_observability(
            public_key=settings.langfuse_public_key,
            secret_key=settings.langfuse_secret_key,
            host=settings.langfuse_host,
        )
    except Exception:
        pass
    yield
    shutdown_observability()


app = FastAPI(lifespan=lifespan)

# WEB_ORIGIN: comma-separated allowed origins. Default "*" for now;
# Phase 1 will lock this to the web app's domain.
_web_origin = os.getenv("WEB_ORIGIN", "*")
_origins = [o.strip() for o in _web_origin.split(",") if o.strip()] or ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials="*" not in _origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(qa.router)
app.include_router(coverage.router)

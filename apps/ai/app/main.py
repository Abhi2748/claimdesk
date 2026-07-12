from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import get_settings
from app.observability import init_observability, shutdown_observability
from app.routers import health, qa


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    init_observability(
        public_key=settings.langfuse_public_key,
        secret_key=settings.langfuse_secret_key,
        host=settings.langfuse_host,
    )
    yield
    shutdown_observability()


app = FastAPI(lifespan=lifespan)
app.include_router(health.router)
app.include_router(qa.router)

import os

import pytest

# Settings are loaded when the FastAPI lifespan starts.
os.environ.setdefault("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("NEXT_PUBLIC_SUPABASE_ANON_KEY", "dummy-anon-key")
os.environ.setdefault("OPENAI_API_KEY", "dummy-openai-key")
os.environ.setdefault("ANTHROPIC_API_KEY", "dummy-anthropic-key")
os.environ.setdefault("EVAL_USER_EMAIL", "eval@example.com")
os.environ.setdefault("EVAL_USER_PASSWORD", "dummy-password")


@pytest.fixture(scope="session")
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as test_client:
        yield test_client

import math

from openai import OpenAI

from app.config import get_settings
from app.constants import EMBEDDING_MODEL

_client: OpenAI | None = None


def _get_openai() -> OpenAI:
    global _client
    if _client is None:
        settings = get_settings()
        _client = OpenAI(api_key=settings.openai_api_key)
    return _client


def embed_query(text: str) -> list[float]:
    openai = _get_openai()
    response = openai.embeddings.create(model=EMBEDDING_MODEL, input=[text])
    sorted_data = sorted(response.data, key=lambda item: item.index)
    return sorted_data[0].embedding


def embedding_to_vector(embedding: list[float]) -> str:
    return f"[{','.join(str(value) for value in embedding)}]"


def vector_from_string(raw: str) -> list[float]:
    """Inverse of embedding_to_vector — parses a pgvector column's textual
    form ("[0.01,0.02,...]", PostgREST's serialization of `vector`) back
    into floats. Used by the coverage agent's grounding-score node to reuse
    a chunk's already-computed ingest-time embedding instead of re-embedding
    its content (ADR 009: "no new API call" for the chunk side).
    """
    return [float(v) for v in raw.strip("[]").split(",")]


def cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)

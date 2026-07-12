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

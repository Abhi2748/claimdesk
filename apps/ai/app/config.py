from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    next_public_supabase_url: str
    next_public_supabase_anon_key: str
    openai_api_key: str
    anthropic_api_key: str
    eval_user_email: str
    eval_user_password: str
    demo_user_email: str | None = None
    demo_user_password: str | None = None
    langfuse_public_key: str | None = None
    langfuse_secret_key: str | None = None
    langfuse_host: str = Field(default="https://cloud.langfuse.com")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()

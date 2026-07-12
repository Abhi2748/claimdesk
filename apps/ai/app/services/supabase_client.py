from supabase import Client, create_client

from app.config import get_settings


def create_user_supabase_client(access_token: str) -> Client:
    settings = get_settings()
    client = create_client(
        settings.next_public_supabase_url,
        settings.next_public_supabase_anon_key,
    )
    client.postgrest.auth(access_token)
    return client

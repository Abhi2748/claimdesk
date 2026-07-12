#!/usr/bin/env python3
"""Sign in as the eval user and print a Supabase access token + policy doc id."""

from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required env var: {name}")
    return value


def resolve_document_id(supabase) -> str:
    doc_id = os.environ.get("DOC_ID")
    if doc_id:
        response = (
            supabase.from_("documents")
            .select("id, ingest_status, doc_type")
            .eq("id", doc_id)
            .single()
            .execute()
        )
        if response.data is None:
            raise RuntimeError(f"DOC_ID not found: {response}")
        doc = response.data
        if doc.get("ingest_status") != "ready":
            raise RuntimeError(
                f"DOC_ID document is not ready (ingest_status={doc.get('ingest_status')})"
            )
        return doc_id

    response = (
        supabase.from_("documents")
        .select("id, ingest_status, doc_type, created_at")
        .eq("doc_type", "policy")
        .eq("ingest_status", "ready")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    if not response.data:
        raise RuntimeError(
            "No ready policy document found. Set DOC_ID or process a policy PDF."
        )

    return response.data[0]["id"]


def main() -> None:
    url = require_env("NEXT_PUBLIC_SUPABASE_URL")
    anon_key = require_env("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    email = require_env("EVAL_USER_EMAIL")
    password = require_env("EVAL_USER_PASSWORD")

    supabase = create_client(url, anon_key)
    auth = supabase.auth.sign_in_with_password({"email": email, "password": password})
    if auth.session is None:
        raise RuntimeError(f"Sign-in failed: {auth}")

    document_id = resolve_document_id(supabase)

    print(f"TOKEN={auth.session.access_token}")
    print(f"DOC_ID={document_id}")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001
        print(exc, file=sys.stderr)
        sys.exit(1)

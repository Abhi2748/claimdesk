"""RLS enforcement proof for coverage_opinions (migration 015) via REAL
signed-in clients — never the Supabase SQL editor (CLAUDE.md rule: it
bypasses RLS as admin and mis-impersonates with null auth.uid()).

A) owner (default org) can insert and then select their own row.
B) demo user (different org) CANNOT select that row (cross-tenant read
   isolation).
C) demo user CANNOT insert into their own org either (demo stays
   read-only, mirroring the existing cases/documents/review_items policy).

Run after applying migration 015, from apps/ai:
    .venv/Scripts/python.exe scripts/prove_coverage_opinions_rls.py
Then delete the probe row this script creates (it cleans up after itself
on success; check by hand if it exits early on failure).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from postgrest.exceptions import APIError
from supabase import create_client

from app.config import get_settings
from app.services.supabase_client import create_user_supabase_client

FIXTURE_CASE_ID = "e5dcbbae-134c-4548-b6d2-74d8de3e5131"  # owner org's fixture case


def sign_in(url: str, anon_key: str, email: str, password: str) -> str:
    auth_client = create_client(url, anon_key)
    resp = auth_client.auth.sign_in_with_password({"email": email, "password": password})
    return resp.session.access_token


def main() -> None:
    settings = get_settings()
    owner_client = create_user_supabase_client(
        sign_in(
            settings.next_public_supabase_url,
            settings.next_public_supabase_anon_key,
            settings.eval_user_email,
            settings.eval_user_password,
        )
    )

    insert_resp = (
        owner_client.table("coverage_opinions")
        .insert(
            {
                "case_id": FIXTURE_CASE_ID,
                "document_ids": [],
                "claim_summary": "RLS isolation probe row — safe to delete.",
                "verdict": "unclear",
                "findings": [],
                "overall_grounding_score": 0.0,
                "model": "rls-probe",
                "latency_ms": 0,
            }
        )
        .execute()
    )
    if not insert_resp.data:
        print("Owner insert FAILED — cannot proceed with isolation probe.")
        sys.exit(1)
    probe_id = insert_resp.data[0]["id"]
    print(f"Owner insert: OK (row {probe_id})")

    owner_select = (
        owner_client.table("coverage_opinions").select("id").eq("id", probe_id).execute()
    )
    owner_can_read_own = len(owner_select.data or []) == 1
    print(f"A) owner reads own-org row: {'OK (allowed) OK' if owner_can_read_own else 'FAILED — should have been visible'}")

    if not settings.demo_user_email or not settings.demo_user_password:
        print("DEMO_USER_EMAIL/DEMO_USER_PASSWORD not set in apps/ai/.env — cannot run B/C.")
        sys.exit(1)
    demo_client = create_user_supabase_client(
        sign_in(
            settings.next_public_supabase_url,
            settings.next_public_supabase_anon_key,
            settings.demo_user_email,
            settings.demo_user_password,
        )
    )
    demo_select = (
        demo_client.table("coverage_opinions").select("id").eq("id", probe_id).execute()
    )
    demo_read_blocked = len(demo_select.data or []) == 0
    print(
        f"B) demo (other org) reads owner's row: "
        f"{'DENIED OK (row invisible)' if demo_read_blocked else 'ALLOWED -- ISOLATION FAILURE'}"
    )

    # A restrictive policy (is_demo()) rejects the write with a hard
    # Postgres error (42501), not a silent empty response — unlike a
    # permissive org-scope mismatch, which just filters the row out.
    try:
        demo_client.table("coverage_opinions").insert(
            {
                "case_id": FIXTURE_CASE_ID,
                "document_ids": [],
                "claim_summary": "demo write probe",
                "verdict": "unclear",
                "findings": [],
                "overall_grounding_score": 0.0,
                "model": "rls-probe",
                "latency_ms": 0,
            }
        ).execute()
        demo_write_blocked = False
    except APIError as exc:
        demo_write_blocked = exc.code == "42501"
        if not demo_write_blocked:
            print(f"    (unexpected error, not an RLS denial: {exc.code} {exc.message})")
    print(
        f"C) demo insert (own org, should stay read-only): "
        f"{'DENIED OK' if demo_write_blocked else 'ALLOWED -- DEMO READ-ONLY INVARIANT BROKEN'}"
    )

    owner_client.table("coverage_opinions").delete().eq("id", probe_id).execute()
    print(f"Cleaned up probe row {probe_id}.")


if __name__ == "__main__":
    main()

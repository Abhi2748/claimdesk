"""Block 2.5e follow-up — COVERAGE_RETRIEVE_TOP_K ablation (12 vs 16 vs 20).

Motivation: 2.5e's golden-set run found claims 2 and 3 reproducibly missing
their controlling clause (IV.5, III.A.8) across two independent runs, with
the agent instead reasoning from real-but-wrong-for-the-question citations.
Working hypothesis was that COVERAGE_RETRIEVE_TOP_K=12 (a first guess, never
benchmarked) doesn't reliably surface the controlling clause for claim-
narrative queries. This sweeps topK at 12/16/20 (POOL fixed at 30 throughout
— isolating topK as the single variable, same discipline as ADR 004's
MIN_CHUNK_CONTENT_CHARS x topK 2x2) against the full (corrected) 10-claim
golden set, real retrieval + real Anthropic calls at every cell.

Run from apps/ai:
    .venv/Scripts/python.exe eval/run_coverage_topk_ablation.py
"""

import json
import statistics
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from run_coverage_eval import GOLDEN_PATH, percentile, score_claim
from supabase import create_client

from app.config import get_settings
from app.observability import init_observability, user_id_from_access_token
from app.services.coverage_agent import run_coverage_agent
from app.services.supabase_client import create_user_supabase_client

FIXTURE_CASE_ID = "e5dcbbae-134c-4548-b6d2-74d8de3e5131"
POOL = 30
TOP_K_VALUES = [12, 16, 20]
WATCH_CLAIM_IDS = {2, 3}  # the two reproducible misses from 2.5e


def run_one_config(supabase, user_id, claims, top_k: int, pool: int) -> dict:
    eval_start = datetime.now(timezone.utc)
    rows = []
    for i, claim in enumerate(claims, 1):
        t0 = time.monotonic()
        try:
            opinion = run_coverage_agent(
                supabase,
                FIXTURE_CASE_ID,
                [claim["document_id"]],
                claim["claim_summary"],
                user_id=user_id,
                retrieve_top_k=top_k,
                retrieve_pool=pool,
            )
        except Exception as exc:
            wall_ms = int((time.monotonic() - t0) * 1000)
            print(f"  [topK={top_k}] [{i}/{len(claims)}] claim {claim['id']} -> ERROR: {exc}")
            rows.append({"id": claim["id"], "status": "ERROR", "latency_ms": wall_ms, "output_chars": 0})
            continue
        status, notes = score_claim(claim, opinion)
        watch = " <-- WATCH" if claim["id"] in WATCH_CLAIM_IDS else ""
        print(
            f"  [topK={top_k}] [{i}/{len(claims)}] claim {claim['id']} -> {status} "
            f"(verdict={opinion.verdict}, {opinion.latency_ms}ms){watch}"
        )
        if notes != "OK":
            print(f"      {notes}")
        rows.append(
            {
                "id": claim["id"],
                "status": status,
                "notes": notes,
                "latency_ms": opinion.latency_ms,
                "verdict": opinion.verdict,
                "output_chars": len(opinion.model_dump_json()),
            }
        )
    eval_end = datetime.now(timezone.utc)
    return {"rows": rows, "eval_start": eval_start, "eval_end": eval_end}


def main() -> None:
    settings = get_settings()
    init_observability(
        public_key=settings.langfuse_public_key,
        secret_key=settings.langfuse_secret_key,
        host=settings.langfuse_host,
    )
    auth_client = create_client(settings.next_public_supabase_url, settings.next_public_supabase_anon_key)
    resp = auth_client.auth.sign_in_with_password(
        {"email": settings.eval_user_email, "password": settings.eval_user_password}
    )
    access_token = resp.session.access_token
    user_id = user_id_from_access_token(access_token)
    supabase = create_user_supabase_client(access_token)

    golden = json.loads(GOLDEN_PATH.read_text(encoding="utf-8"))
    claims = golden["claims"]

    results = {}
    for top_k in TOP_K_VALUES:
        print(f"\n=== Config: topK={top_k}, pool={POOL} ===")
        results[top_k] = run_one_config(supabase, user_id, claims, top_k, POOL)

    # --- Per-node breakdown per config, from Langfuse ---
    from langfuse import Langfuse

    print("\nWaiting for Langfuse ingestion to catch up...")
    time.sleep(8)
    lf = None
    if settings.langfuse_public_key and settings.langfuse_secret_key:
        lf = Langfuse(
            public_key=settings.langfuse_public_key,
            secret_key=settings.langfuse_secret_key,
            host=settings.langfuse_host,
        )

    print("\n" + "=" * 70)
    print("=== Summary table ===")
    print("=" * 70)
    summary_rows = []
    for top_k in TOP_K_VALUES:
        r = results[top_k]
        rows = r["rows"]
        completed = [x for x in rows if x["status"] != "ERROR"]
        passes = sum(1 for x in rows if x["status"] == "PASS")
        fails = sum(1 for x in rows if x["status"] == "FAIL")
        severes = sum(1 for x in rows if x["status"] == "SEVERE")
        errors = sum(1 for x in rows if x["status"] == "ERROR")
        latencies = [x["latency_ms"] for x in completed]
        p50 = percentile(latencies, 50)
        p95 = percentile(latencies, 95)

        watch_status = {x["id"]: x["status"] for x in rows if x["id"] in WATCH_CLAIM_IDS}

        draft_opinion_latencies = []
        if lf is not None:
            obs = lf.api.observations.get_many(
                name="claude_answer", from_start_time=r["eval_start"], to_start_time=r["eval_end"], limit=100
            )
            draft_opinion_latencies = [o.latency for o in obs.data if o.latency is not None]

        output_chars = [x["output_chars"] for x in completed]
        est_output_tokens = statistics.fmean(output_chars) / 4 if output_chars else 0

        summary_rows.append(
            {
                "top_k": top_k,
                "pool": POOL,
                "PASS": passes,
                "FAIL": fails,
                "SEVERE": severes,
                "ERROR": errors,
                "p50_ms": p50,
                "p95_ms": p95,
                "draft_opinion_p50_s": percentile(draft_opinion_latencies, 50) if draft_opinion_latencies else None,
                "claim2_status": watch_status.get(2),
                "claim3_status": watch_status.get(3),
                "est_output_tokens_mean": est_output_tokens,
            }
        )
        do_p50_str = (
            f"{percentile(draft_opinion_latencies, 50):.1f}s" if draft_opinion_latencies else "n/a"
        )
        print(
            f"topK={top_k:2d} pool={POOL} | PASS={passes} FAIL={fails} SEVERE={severes} ERROR={errors} "
            f"| p50={p50:.0f}ms p95={p95:.0f}ms | draft_opinion_p50={do_p50_str}"
        )
        print(f"    claim 2 (IV.5 vehicle exclusion): {watch_status.get(2)}")
        print(f"    claim 3 (III.A.8 basement limit): {watch_status.get(3)}")

    # --- Write report ---
    out_path = Path(__file__).resolve().parent / "coverage-topk-ablation-results.md"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("# Coverage agent COVERAGE_RETRIEVE_TOP_K ablation (12 vs 16 vs 20)\n\n")
        f.write(f"Run: {datetime.now(timezone.utc).isoformat()}\n\n")
        f.write("POOL fixed at 30 across all cells — topK is the single variable.\n\n")
        f.write(
            "| topK | pool | PASS | FAIL | SEVERE | ERROR | p50 ms | p95 ms | "
            "draft_opinion p50 (s) | claim 2 (IV.5) | claim 3 (III.A.8) | est. output tokens |\n"
        )
        f.write("|---|---|---|---|---|---|---|---|---|---|---|---|\n")
        for r in summary_rows:
            do_p50 = f"{r['draft_opinion_p50_s']:.1f}" if r["draft_opinion_p50_s"] is not None else "n/a"
            f.write(
                f"| {r['top_k']} | {r['pool']} | {r['PASS']} | {r['FAIL']} | {r['SEVERE']} | {r['ERROR']} | "
                f"{r['p50_ms']:.0f} | {r['p95_ms']:.0f} | {do_p50} | {r['claim2_status']} | "
                f"{r['claim3_status']} | {r['est_output_tokens_mean']:.0f} |\n"
            )
        f.write("\n## Full row data per config\n\n")
        for top_k in TOP_K_VALUES:
            f.write(f"\n### topK={top_k}\n\n| id | status | verdict | latency_ms | notes |\n|---|---|---|---|---|\n")
            for x in results[top_k]["rows"]:
                notes = x.get("notes", "").replace("|", "\\|")
                f.write(f"| {x['id']} | {x['status']} | {x.get('verdict')} | {x['latency_ms']} | {notes} |\n")
    print(f"\nWrote {out_path}")


if __name__ == "__main__":
    main()

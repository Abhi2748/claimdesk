"""Block 2.5e — golden coverage-set eval + latency/cost distribution.

Calls run_coverage_agent() directly (the same function the background
task calls, app/routers/coverage.py) against every claim in
golden-coverage.json, scores each opinion per the rubric in that file's
scoring_rules, then pulls the per-node latency breakdown back out of
Langfuse via the observations API (each node already emits a span,
Block 2.5d) so the report shows which node dominates, not just a single
end-to-end number.

Run from apps/ai:
    .venv/Scripts/python.exe eval/run_coverage_eval.py
"""

import json
import statistics
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from supabase import create_client

from app.config import get_settings
from app.observability import init_observability, user_id_from_access_token
from app.services.coverage_agent import run_coverage_agent
from app.services.supabase_client import create_user_supabase_client

FIXTURE_CASE_ID = "e5dcbbae-134c-4548-b6d2-74d8de3e5131"
GOLDEN_PATH = Path(__file__).resolve().parent / "golden-coverage.json"
NODE_NAMES = ["retrieval", "claude_answer", "verify_and_score", "write_review_queue"]


def _section_prefixes(label: str) -> list[str]:
    token = label.strip().split()[0].upper() if label.strip() else ""
    if not token:
        return []
    segs = token.split(".")
    return [".".join(segs[:i]) for i in range(1, len(segs) + 1)]


def _cites(findings, must_label: str) -> bool:
    must = must_label.strip().upper()
    for f in findings:
        cited = f.citation.section_label.strip().split()[0].upper() if f.citation.section_label.strip() else ""
        if must in _section_prefixes(cited) or cited in _section_prefixes(must) or cited == must:
            return True
    return False


FLAT_REVERSALS = {("covered", "excluded"), ("excluded", "covered")}


def score_claim(claim: dict, opinion) -> tuple[str, str]:
    findings = opinion.findings
    all_verified = all(f.verified for f in findings) if findings else False
    is_reversal = (claim["expected_verdict"], opinion.verdict) in FLAT_REVERSALS

    if not all_verified:
        unverified = [f.statement[:50] for f in findings if not f.verified]
        return "SEVERE", f"Unverified (invented) citation(s): {unverified}"
    if is_reversal:
        return "SEVERE", f"Flat reversal: expected {claim['expected_verdict']}, got {opinion.verdict}"

    verdict_match = opinion.verdict == claim["expected_verdict"]
    missing_cites = [m for m in claim["must_cite"] if not _cites(findings, m)]

    if verdict_match and not missing_cites:
        return "PASS", "OK"
    notes = []
    if not verdict_match:
        notes.append(f"verdict {opinion.verdict} != expected {claim['expected_verdict']}")
    if missing_cites:
        notes.append(f"missing cite(s): {missing_cites}")
    return "FAIL", "; ".join(notes)


def percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    idx = min(len(s) - 1, max(0, round((p / 100) * (len(s) - 1))))
    return s[idx]


def main() -> None:
    settings = get_settings()
    # This script never runs FastAPI's lifespan (app/main.py), which is the
    # only other place init_observability() is called — without this, every
    # tracing context manager in observability.py silently no-ops (fail-open
    # by design), and the per-node breakdown below finds nothing. Bit us on
    # the first run of this script.
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
            )
        except Exception as exc:
            wall_ms = int((time.monotonic() - t0) * 1000)
            print(f"[{i}/{len(claims)}] {claim['form']} claim {claim['id']} -> ERROR ({wall_ms}ms): {exc}")
            rows.append(
                {
                    "id": claim["id"],
                    "form": claim["form"],
                    "status": "ERROR",
                    "notes": str(exc),
                    "latency_ms": wall_ms,
                    "verdict": None,
                    "expected_verdict": claim["expected_verdict"],
                }
            )
            continue
        status, notes = score_claim(claim, opinion)
        print(
            f"[{i}/{len(claims)}] {claim['form']} claim {claim['id']} -> {status} "
            f"(verdict={opinion.verdict}, expected={claim['expected_verdict']}, "
            f"{opinion.latency_ms}ms, grounding={opinion.overall_grounding_score:.2f})"
        )
        if notes != "OK":
            print(f"    {notes}")
        rows.append(
            {
                "id": claim["id"],
                "form": claim["form"],
                "status": status,
                "notes": notes,
                "latency_ms": opinion.latency_ms,
                "verdict": opinion.verdict,
                "expected_verdict": claim["expected_verdict"],
                "overall_grounding_score": opinion.overall_grounding_score,
                "finding_count": len(opinion.findings),
                "output_chars": len(opinion.model_dump_json()),
            }
        )
    eval_end = datetime.now(timezone.utc)

    # --- Aggregate scoring ---
    completed = [r for r in rows if r["status"] != "ERROR"]
    passes = sum(1 for r in rows if r["status"] == "PASS")
    fails = sum(1 for r in rows if r["status"] == "FAIL")
    severes = sum(1 for r in rows if r["status"] == "SEVERE")
    errors = sum(1 for r in rows if r["status"] == "ERROR")

    latencies = [r["latency_ms"] for r in completed]
    p50 = percentile(latencies, 50)
    p95 = percentile(latencies, 95)

    print("\n=== Score ===")
    print(f"PASS={passes} FAIL={fails} SEVERE={severes} ERROR={errors} / {len(rows)}")
    print(f"Latency (graph-measured): p50={p50:.0f}ms p95={p95:.0f}ms mean={statistics.fmean(latencies):.0f}ms" if latencies else "No completed runs.")

    # --- Per-node breakdown from Langfuse (Block 2.5d's spans) ---
    from langfuse import Langfuse

    print("\nWaiting for Langfuse ingestion to catch up before querying...")
    time.sleep(8)

    per_node = {}
    if settings.langfuse_public_key and settings.langfuse_secret_key:
        lf = Langfuse(
            public_key=settings.langfuse_public_key,
            secret_key=settings.langfuse_secret_key,
            host=settings.langfuse_host,
        )
        for name in NODE_NAMES:
            obs = lf.api.observations.get_many(
                name=name, from_start_time=eval_start, to_start_time=eval_end, limit=100
            )
            node_latencies = [o.latency for o in obs.data if o.latency is not None]
            per_node[name] = node_latencies
        print("\n=== Per-node latency (from Langfuse spans, seconds) ===")
        for name, vals in per_node.items():
            if vals:
                print(
                    f"  {name}: n={len(vals)} p50={percentile(vals, 50):.2f}s "
                    f"p95={percentile(vals, 95):.2f}s mean={statistics.fmean(vals):.2f}s"
                )
            else:
                print(f"  {name}: no observations found in window")

        # Real Anthropic generation cost from Langfuse's usage-based cost calc,
        # if this SDK/endpoint returns it (it didn't in testing — the v2 list
        # endpoint only returns latency, no usage/cost fields, and this client
        # has no per-ID detail fetch). Falls back to the same char/4 estimate
        # method as ADR 001, but grounded in this run's real output size, not
        # a guess: input side from one real retrieve_hybrid() call (system +
        # tool schema + actual retrieved passages for a representative claim),
        # output side from every opinion's real serialized size.
        gen_obs = lf.api.observations.get_many(
            name="claude_answer", from_start_time=eval_start, to_start_time=eval_end, limit=100
        )
        costs = [o.total_cost for o in gen_obs.data if o.total_cost is not None]
        if costs:
            print(
                f"\n=== Anthropic generation cost (real, from Langfuse) ===\n"
                f"  n={len(costs)} mean=${statistics.fmean(costs):.4f} "
                f"total=${sum(costs):.4f}"
            )
        else:
            print(
                "\nLangfuse returned no usage/cost fields for this SDK/endpoint "
                "(latency-only) — falling back to a char/4 estimate."
            )
            from app.constants import (
                COVERAGE_RETRIEVE_POOL,
                COVERAGE_RETRIEVE_TOP_K,
                COVERAGE_SYSTEM_PROMPT,
            )
            from app.schemas.coverage import DraftOpinion
            from app.services.anthropic import format_matter_passages_for_prompt
            from app.services.qa_pipeline import retrieve_hybrid

            sample_claim = claims[0]
            sample_chunks, _ = retrieve_hybrid(
                supabase,
                [sample_claim["document_id"]],
                sample_claim["claim_summary"],
                COVERAGE_RETRIEVE_TOP_K,
                COVERAGE_RETRIEVE_POOL,
            )
            passages_text = format_matter_passages_for_prompt(sample_chunks)
            schema_chars = len(json.dumps(DraftOpinion.model_json_schema()))
            input_chars = (
                len(COVERAGE_SYSTEM_PROMPT)
                + schema_chars
                + len(sample_claim["claim_summary"])
                + len(passages_text)
                + 40
            )
            input_tokens_est = input_chars / 4
            output_chars = [r["output_chars"] for r in completed if "output_chars" in r]
            output_tokens_ests = [c / 4 for c in output_chars]
            # claude-sonnet-4-6 pricing, per ADR 001/007: $3/$15 per MTok in/out.
            in_cost = input_tokens_est * 3 / 1_000_000
            total_costs = [in_cost + (t * 15 / 1_000_000) for t in output_tokens_ests]
            print(
                f"  est. input tokens/call ~= {input_tokens_est:.0f} (1 representative retrieval, "
                f"claim {sample_claim['id']})\n"
                f"  est. cost/opinion: mean=${statistics.fmean(total_costs):.4f} "
                f"min=${min(total_costs):.4f} max=${max(total_costs):.4f}\n"
                f"  est. total for {len(total_costs)} opinions: ${sum(total_costs):.4f}\n"
                f"  (embedding cost not included — negligible per ADR 001's existing estimate)"
            )
    else:
        print("\nLangfuse not configured — skipping per-node breakdown and real cost pull.")

    # --- Write report ---
    out_path = Path(__file__).resolve().parent / "coverage-eval-results.md"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(f"# Coverage agent golden-set eval (Block 2.5e)\n\nRun: {eval_start.isoformat()}\n\n")
        f.write(f"PASS={passes} FAIL={fails} SEVERE={severes} ERROR={errors} / {len(rows)}\n\n")
        if latencies:
            f.write(f"Latency (graph-measured): p50={p50:.0f}ms p95={p95:.0f}ms\n\n")
        f.write("| id | form | status | verdict | expected | latency_ms | grounding | notes |\n")
        f.write("|---|---|---|---|---|---|---|---|\n")
        for r in rows:
            grounding = r.get("overall_grounding_score")
            grounding_str = f"{grounding:.2f}" if grounding is not None else ""
            notes = r["notes"].replace("|", "\\|")
            f.write(
                f"| {r['id']} | {r['form']} | {r['status']} | {r.get('verdict')} | "
                f"{r['expected_verdict']} | {r['latency_ms']} | {grounding_str} | {notes} |\n"
            )
        if per_node:
            f.write("\n## Per-node latency (seconds, from Langfuse spans)\n\n")
            f.write("| node | n | p50 | p95 | mean |\n|---|---|---|---|---|\n")
            for name, vals in per_node.items():
                if vals:
                    f.write(
                        f"| {name} | {len(vals)} | {percentile(vals, 50):.2f} | "
                        f"{percentile(vals, 95):.2f} | {statistics.fmean(vals):.2f} |\n"
                    )
    print(f"\nWrote {out_path}")


if __name__ == "__main__":
    main()

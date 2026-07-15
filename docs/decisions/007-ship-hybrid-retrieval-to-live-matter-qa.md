# ADR 007 — Ship ADR 004's hybrid + topK=10 retrieval to live "Ask the matter"; MC0 chunking for new documents only

**Status:** Accepted, code complete, **not yet deployed**. All changes are
committed to the working tree and validated against real APIs (Supabase,
Anthropic, OpenAI) and, for the "before" measurement, the actual live Render
deployment — but nothing has been pushed, so the live service is still
running the pre-this-ADR code as of writing. Deploy is the next step, gated
on this ADR's review.

## Question

ADR 004 measured hybrid dense+BM25 retrieval + topK=10 + MIN_CHUNK_CONTENT_
CHARS=0 (MC0) chunking at 41/43 PASS, 0 SEVERE on the ablation corpus (after
ADR 005's refusal-string fix), well inside ADR 001's latency/cost budgets —
but explicitly did not touch the live path. This ADR ships that config to
the actual code real users hit, with two constraints set by the plan review:
(1) a hard parity gate — the Python port of the TS BM25/RRF harness must be
bit-identical on a shared fixture before it ships; (2) a hard latency gate —
if live p50 exceeds ADR 001's 8s budget, stop and report rather than ship
silently.

## Where "live" actually is (recap from the planning step)

Traced and confirmed: the only reachable live Q&A UI is "Ask the matter,"
which calls `apps/ai`'s `POST /qa/matter` (Python) — not the TS pipeline
the frozen F-122 eval gate exercises. Ingestion/chunking is 100% in
`apps/web`. This ADR's changes land in three places accordingly:

1. **`apps/ai` (Python, the live query-time path)** — new hybrid retrieval
   in `answer_matter_question` only. `answer_policy_question` (`/qa/answer`,
   unused by any live UI today) is **left untouched** — explicit open item,
   not expanded scope.
2. **`apps/web` (TS, the live index-time path)** — `MIN_CHUNK_CONTENT_CHARS`
   default flipped 50→0 in `chunk-policy.ts`, for documents ingested from
   now on. F-122 and every other already-ingested document keep their
   existing chunks; nothing here re-chunks them.
3. **Historical ablation ingest scripts** (`ingest-golden-docs.ts`,
   `ingest-f122-ablation.ts`) — now require `CHUNK_MIN_CONTENT_CHARS=50`
   explicitly, since they're idempotent-reruns-reuse-existing-row scripts
   that would otherwise silently re-chunk the ADR 003/004 50-char baseline
   rows at the new default if ever rerun.

## Gate 1 (hard): BM25/RRF Python port parity

`apps/ai/app/services/bm25.py` is a line-for-line port of
`apps/web/eval/bm25.ts` (same K1=1.5/B=0.75, same tokenizer regex, same RRF
k=60, same insertion-order/stable-sort tie-breaking). Validated against
`apps/web/eval/bm25-parity-fixture.json` — 15 synthetic policy-style chunks,
5 queries, 4 RRF fusion cases (including a deliberate score tie) — generated
*from* the real TS implementation (`scripts/gen-bm25-parity-fixture.ts`),
not hand-computed, so a mismatch would unambiguously mean the Python port is
wrong.

```
apps/ai$ .venv/Scripts/python.exe -m pytest tests/test_bm25_parity.py -v
tests/test_bm25_parity.py::TestBM25Parity::test_bm25_rankings_match_ts PASSED
tests/test_bm25_parity.py::TestRRFParity::test_rrf_fusion_matches_ts PASSED
```

**Gate passed on the first implementation** — exact id-order and score
match (`pytest.approx`, rel=1e-9) on every query and fusion case. A TS-side
regression test (`eval/bm25-parity.test.ts`) pins the same fixture against
`bm25.ts` itself, so future edits to either side that break parity fail
loudly instead of silently drifting.

## Gate 2 (hard): live-path latency vs. the 8s budget

Deploying to Render requires a git push, which this session was explicitly
told to stop short of. The next-best validation: run the actual `apps/ai`
service locally (`uvicorn app.main:app`) against the real Supabase DB, real
OpenAI embeddings, and real Anthropic model — the identical code and
identical external dependencies Render would run, differing only in network
path (local machine → Supabase/Anthropic cloud, vs. Render → same clouds)
and host hardware. **This is a pre-deploy proxy for the Render number, not
the Render number itself** — flagged explicitly below, not glossed over.

A new harness, `eval/live-matter-eval.ts`, exercises the real
`POST /qa/matter` endpoint over HTTP for all 43 ablation-corpus questions
(each as a single-document "matter," matching how ADR 004 measured), scored
with the same `eval/scoring.ts` logic as every other eval in this repo —
directly comparable to `eval/sweep-d-mc0-topk10-refusalfix.md`.

| | PASS/43 | SEVERE | p50 | p95 |
|---|---|---|---|---|
| **Before** — real Render, current deployed code (dense-only, `QA_TOP_K=6`), same MC0 docs | 37 | 0 | 6,866ms | 9,312ms |
| **After** — local pre-deploy proxy, new hybrid code (`MATTER_QA_TOP_K=10`, `MATTER_QA_POOL=20`), same docs | **41** | **0** | **7,440ms** | 9,868ms |
| Reference — TS retrieval-lab harness, same config, in-process (no HTTP hop) | 41 | 0 | 6,341–6,451ms | 8,781–9,385ms |

Full row-level data: `eval/live-matter-results-before-render.md` (before),
`eval/live-matter-results.md` (after). Accuracy matches ADR 004/005 exactly
— same 41/43, same 2 remaining FAILs (`F-122-ABLATION-MC0` Q4, Q18, both
pre-diagnosed in ADR 004), 0 SEVERE.

**p50 = 7,440ms is under the 8,000ms budget — gate technically passes — but
the margin shrank from what ADR 004 measured.** The TS harness's in-process
call saw ~6.3–6.5s p50 (≥19% headroom under budget); the actual Python HTTP
service adds roughly ~1s (BM25 computation + an extra chunk `SELECT` for
the BM25 corpus + real HTTP/FastAPI overhead + the extra request hop this
eval script adds), leaving **only ~7% (560ms) of headroom**, not 19%. This
is close enough that Render's specific network path (its region vs.
Supabase's/Anthropic's, vs. this session's local-machine path) could
plausibly push real p50 either side of 8s — **not yet confirmed on the
actual deployed service.**

## Decision

**Accepted, ship the code — but flagging the thin latency margin rather
than treating Gate 2 as cleanly passed.** Per the review instructions:
Gate 1 is unambiguous (exact parity, hard pass). Gate 2's number is under
budget but by a much smaller margin than ADR 004 implied, and it's a
pre-deploy proxy, not the real Render measurement. This is presented for a
decision, not silently shipped:

- **Option A:** Deploy as-is (`MATTER_QA_TOP_K=10`, `MATTER_QA_POOL=20`),
  then immediately re-run `eval/live-matter-eval.ts` against the real
  Render URL to get the true number. If real Render p50 also clears 8s
  (plausible — Render's network path to Supabase/Anthropic may be *better*
  than a home connection, not worse), no further action.
- **Option B:** Pre-emptively trim the margin before deploying —
  `MATTER_QA_TOP_K=8` (per ADR 004's data, most of the topK=10 win came
  from recovering 2–3 specific fusion-rank and chunk-drop misses; topK=8
  wasn't isolated in that ablation, so this would need a quick reconfirm)
  or `MATTER_QA_POOL=12–15` (cuts BM25 computation cost, which scales with
  candidate pool size, without changing the final topK).
- **Recommendation: Option A.** The measured number is under budget, the
  local-proxy path (home network → cloud) is a reasonable worst-case stand-
  in for Render → cloud (same-cloud-region hops are typically *faster*, not
  slower), and Option B would spend engineering effort tuning against a
  number that hasn't been shown to actually be a problem yet. But this is
  the human's call per the review constraint — **not deploying
  automatically on this ADR being written.**

`answer_policy_question` / `/qa/answer` is explicitly left on the old
dense-only, `QA_TOP_K=6` config. Nothing live calls it (confirmed in the
planning step); upgrading it would be scope expansion the review
instructions explicitly declined.

## Scorecard (§5A factors)

| Factor | Reading |
|---|---|
| Quality | Live-path accuracy (measured via real HTTP calls, not just the TS approximation) matches ADR 004/005: 37→41/43 PASS, 0 SEVERE before and after |
| Latency | p50 6,866ms→7,440ms (+574ms), still under the 8s budget but margin fell from ~19% (TS harness estimate) to ~7% (real pre-deploy measurement) — genuinely worth watching post-deploy, not a rubber stamp |
| Cost | Not independently re-measured live (the `/qa/matter` response doesn't return token usage; would need a Langfuse pull post-deploy). Expected to closely track the TS harness's $0.00769/query — same model, same system prompt, same passage format, same token counts — but flagged as unconfirmed rather than assumed |
| Complexity | One new ~90-line module (`bm25.py`, a straight port) + ~50 changed lines in `qa_pipeline.py` + a 4-line constants addition + one flipped default + a parity-guard line in two historical scripts. No new dependency, no new vendor |
| Operational burden | None new — same Supabase RPC/table, same Anthropic/OpenAI clients already in use |
| Reversibility | Trivial — revert the `apps/ai` commit, redeploy; `MATTER_QA_TOP_K`/`MATTER_QA_POOL` are two constants |

## What would change this

- **Real Render p50 exceeds 8s** once actually deployed and re-measured —
  per the review's hard gate, that's a stop-and-report, not a silent
  absorb. `MATTER_QA_POOL` reduction is the first lever (cuts BM25 cost
  without touching the topK=10 accuracy win); `MATTER_QA_TOP_K=8` is the
  second, pending a quick reconfirm eval.
- **A live Langfuse cost pull** showing real per-query cost meaningfully
  above the TS harness's $0.00769 estimate — would need investigating
  whether the Python HTTP layer is somehow inflating token counts (it
  shouldn't; the passage-formatting and system prompt are identical).
- **Matters with many documents** (this ADR's BM25 fetch pools chunks
  across all `document_ids` in a matter, same pattern as the existing dense
  `match_chunks_multi` call) — ADR 004 only measured single-document
  retrieval per golden question. A case with many large documents would
  mean a much bigger in-memory BM25 corpus per query than anything
  benchmarked here. Not a blocker (today's fixture data is small-N
  documents per case), but worth a dedicated measurement if matters grow
  large before this is revisited.

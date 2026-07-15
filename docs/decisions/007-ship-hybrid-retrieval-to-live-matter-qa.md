# ADR 007 — Ship ADR 004's hybrid retrieval to live "Ask the matter" (topK=8, not 10); MC0 chunking for new documents only

**Status:** Accepted and **deployed**. Shipped, measured live on Render,
found over budget at `MATTER_QA_TOP_K=10`, mitigated to `MATTER_QA_TOP_K=8`
per this ADR's own contingency plan, redeployed, and reconfirmed in budget
with unchanged accuracy. Both the failure and the fix happened in production
review, not hypothetically — this ADR documents the real sequence, not just
the intended one.

## Question

ADR 004 measured hybrid dense+BM25 retrieval + topK=10 + MIN_CHUNK_CONTENT_
CHARS=0 (MC0) chunking at 41/43 PASS, 0 SEVERE on the ablation corpus (after
ADR 005's refusal-string fix), well inside ADR 001's latency/cost budgets —
but explicitly did not touch the live path. This ADR ships that config to
the actual code real users hit, with two constraints set by the plan review:
(1) a hard parity gate — the Python port of the TS BM25/RRF harness must be
bit-identical on a shared fixture before it ships; (2) a hard latency gate —
if live p50 exceeds ADR 001's 8s budget, stop and report rather than ship
silently, and apply the named mitigation (`MATTER_QA_TOP_K=8` first) if it
does.

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

Before deploying, ran the actual `apps/ai` service locally (`uvicorn
app.main:app`) against the real Supabase DB, real OpenAI embeddings, and
real Anthropic model — the identical code and identical external
dependencies Render would run, differing only in network path. That
pre-deploy proxy measured p50=7,440ms — under budget, but flagged
explicitly as unconfirmed on the real deployment, with a much thinner
margin (~7%) than ADR 004's TS harness implied (~19%). The decision at that
point was to ship and re-measure for real rather than guess. That's what
happened next, and the guess would have been wrong:

A new harness, `eval/live-matter-eval.ts`, exercises the real
`POST /qa/matter` endpoint over HTTP for all 43 ablation-corpus questions
(each as a single-document "matter," matching how ADR 004 measured), scored
with the same `eval/scoring.ts` logic as every other eval in this repo —
directly comparable to `eval/sweep-d-mc0-topk10-refusalfix.md`.

| | PASS/43 | SEVERE | p50 | p95 | vs. 8s/12s budget |
|---|---|---|---|---|---|
| **Before** — real Render, pre-ADR-007 code (dense-only, `QA_TOP_K=6`), MC0 docs | 37 | 0 | 6,866ms | 9,312ms | in budget |
| Local pre-deploy proxy — new hybrid code, `MATTER_QA_TOP_K=10` | 41 | 0 | 7,440ms | 9,868ms | in budget (thin margin, unconfirmed) |
| **Real Render, `MATTER_QA_TOP_K=10`** | 41 | 0 | **8,019ms** | **12,164ms** | **OVER budget on both** |
| **Real Render, `MATTER_QA_TOP_K=8`** (shipped) | **41** | **0** | **7,576ms** | 11,278ms | in budget |

Full row-level data: `eval/live-matter-results-before-render.md` (dense/
topK=6 baseline), `eval/live-matter-results-render-topk10.md` (over
budget), `eval/live-matter-results-render-topk8.md` (final, shipped).
Accuracy is identical across every hybrid configuration measured — 41/43,
the same 2 pre-diagnosed FAILs (`F-122-ABLATION-MC0` Q4, Q18), 0 SEVERE
whether topK is 10 or 8. **The local pre-deploy proxy underestimated real
Render latency by ~580ms at p50 and ~2,300ms at p95** — Render's actual
network path to Supabase/Anthropic (or its instance sizing) is measurably
slower than this session's local-machine path, the opposite of what seemed
like the more likely direction beforehand. This is exactly why the review
required a real post-deploy re-check rather than accepting the local proxy
as sufficient.

**Mitigation applied per the gate's own contingency plan:** dropped
`MATTER_QA_TOP_K` from 10 to 8 (`MATTER_QA_POOL` left at 20, unchanged),
redeployed, re-measured against the real Render URL. Result: **p50=7,576ms,
p95=11,278ms — both back in budget, and accuracy is unchanged (41/43, 0
SEVERE)**. topK=8 wasn't isolated in ADR 004's ablation (only 6 and 10 were
tested), so this was a genuine open question, not an assumed-safe fallback
— it happened to recover the full topK=10 accuracy win on this corpus while
cutting enough retrieval/generation cost (fewer passages sent to the
answerer) to close the latency gap.

## Decision

**Accepted and shipped at `MATTER_QA_TOP_K=8`, not the originally-planned
10.** Gate 1 (parity) passed cleanly and unconditionally. Gate 2 (latency)
initially failed for real on the actual deployment — not hypothetically,
not on a proxy — at topK=10 (p50 8,019ms, p95 12,164ms, both over budget).
The named first mitigation (topK=8) was applied, redeployed, and
re-confirmed in budget with zero accuracy cost. `MATTER_QA_POOL=20` (the
BM25/dense candidate pool size) is unchanged; if a future latency
regression reappears, that's the next lever, per ADR 004's original
mitigation list.

`answer_policy_question` / `/qa/answer` is explicitly left on the old
dense-only, `QA_TOP_K=6` config. Nothing live calls it (confirmed in the
planning step); upgrading it would be scope expansion the review
instructions explicitly declined.

## Scorecard (§5A factors)

| Factor | Reading |
|---|---|
| Quality | Live-path accuracy (measured via real HTTP calls against real Render, not a proxy) matches ADR 004/005 exactly: 37→41/43 PASS, 0 SEVERE, and **identical at topK=10 and topK=8** — the mitigation cost zero accuracy on this corpus |
| Latency | p50 6,866ms→**8,019ms at topK=10 (over budget)**→**7,576ms at topK=8 (shipped, in budget)**. The local pre-deploy proxy (7,440ms) underestimated real Render latency by ~580ms — proxy measurements are directionally useful but not a substitute for a real post-deploy check, exactly as this gate's design assumed |
| Cost | Not independently re-measured live (the `/qa/matter` response doesn't return token usage; would need a Langfuse pull). topK=8 sends fewer passages to the answerer than topK=10, so real cost is expected to be at or below the TS harness's $0.00769/query estimate — still unconfirmed, not assumed |
| Complexity | One new ~90-line module (`bm25.py`, a straight port) + ~50 changed lines in `qa_pipeline.py` + a 6-line constants change + one flipped chunking default + a parity-guard line in two historical scripts. No new dependency, no new vendor |
| Operational burden | None new — same Supabase RPC/table, same Anthropic/OpenAI clients already in use |
| Reversibility | Trivial — revert the `apps/ai` commits, redeploy; `MATTER_QA_TOP_K`/`MATTER_QA_POOL` are two constants. Already exercised once in this ADR (10→8) |

## What would change this

- **`MATTER_QA_POOL=20` reduction** is the next lever if a future latency
  regression reappears (e.g. corpus growth, Render instance changes) —
  cuts BM25 computation cost without changing the final topK, per ADR 004's
  original mitigation list. Not yet needed; topK=8 alone recovered budget.
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
- **If topK=8 vs. 10's accuracy parity doesn't hold on a larger/different
  corpus** (this ADR's 43-question sample showed zero difference, which
  could be a corpus-size coincidence rather than a robust result) —
  worth re-checking once the golden corpus grows.
- **The gap between the local pre-deploy proxy and real Render** (~580ms at
  p50, ~2,300ms at p95) is itself worth understanding before relying on
  local measurements again for a latency-sensitive decision — possible
  causes not investigated here: Render instance CPU/memory tier, network
  hop count/region distance to Supabase or Anthropic, or cold-start effects
  on the specific requests measured.

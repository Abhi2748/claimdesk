# ADR 010 — Coverage agent `COVERAGE_RETRIEVE_TOP_K`: 12 → 16, `POOL` unchanged

**Status:** Accepted and shipped. `COVERAGE_RETRIEVE_TOP_K` was a first
guess in ADR 009 (12, "provisional, not benchmarked"). This ADR benchmarks
it against the two reproducible misses ADR 009's 2.5e run surfaced and adopts
the value the data supports — the same "measure, then correct" shape as
ADR 007's `MATTER_QA_TOP_K` 10→8, on the accuracy axis instead of latency.

## Question

ADR 009's real measurement (2.5e) found 3/10 golden claims FAILing
identically across two independent runs. Two of the three were the
concerning kind: the agent never cited the actual controlling clause
(`IV.5`, a vehicle exclusion; `III.A.8`, a basement-item limitation) and
built plausible-but-wrong reasoning from real, `verified=true` citations
instead. Working hypothesis: `COVERAGE_RETRIEVE_TOP_K=12` doesn't reliably
surface the controlling clause for claim-narrative queries. Does raising it
fix these two cases, and at what latency/cost?

## Method

Full 10-claim golden set (`apps/ai/eval/golden-coverage.json`, claim 7
corrected per human review), real retrieval + real Anthropic calls, three
values of `COVERAGE_RETRIEVE_TOP_K` — 12, 16, 20 — with `COVERAGE_RETRIEVE_
POOL` **fixed at 30** across all three cells, isolating topK as the single
variable (same discipline as ADR 004's `MIN_CHUNK_CONTENT_CHARS` × topK
2×2). `apps/ai/eval/run_coverage_topk_ablation.py`; full row-level data in
`apps/ai/eval/coverage-topk-ablation-results.md`.

## Result

| topK | pool | PASS | FAIL | SEVERE | p50 | p95 | `draft_opinion` p50 | claim 2 (`IV.5`) | claim 3 (`III.A.8`) | est. output tokens |
|---|---|---|---|---|---|---|---|---|---|---|
| 12 | 30 | 7/10 | 3 | 0 | 21,221ms | 25,436ms | 18.3s | FAIL | FAIL | 1,029 |
| **16** | 30 | **8/10** | 2 | 0 | **19,446ms** | **25,026ms** | 16.6s | FAIL | **PASS** | 1,005 |
| 20 | 30 | 8/10 | 2 | 0 | 21,409ms | **31,558ms** | 18.7s | FAIL | PASS | 1,142 |

### Does deeper retrieval surface IV.5 and III.A.8? One yes, one no — with root causes, not guesses

Pulled the full 30-candidate fused ranking directly (`retrieve_hybrid()`
called with `top_k=pool=30`, so nothing is cut off) for both claims'
queries to see *why*, not just *whether*:

- **`III.A.8` (claim 3, basement limitation): yes, a clean cutoff-depth
  story.** `III.A.8.a` (the matched child section) ranks **#13** in the
  fused list — 1 position outside topK=12's cutoff, comfortably inside
  topK=16's. This is mechanistically identical to ADR 004's `F-123 Q8`
  recovery (missed cutoff by 2, fixed by a wider topK) — the content was
  always in reach, the window was just too narrow.
- **`IV.5` (claim 2, vehicle exclusion): no — it isn't in the candidate
  pool at all, at any rank, up to 30.** Widening topK further cannot find
  what widening the *pool* doesn't surface. The claim's language ("riding
  lawn mower," "attached garage," "floodwater entered the garage") doesn't
  share enough vocabulary or embedding similarity with `IV.5`'s clause
  text ("Self-propelled vehicles or machines, including their parts and
  equipment...") to rank in the fused top-30 via either dense or BM25
  signals — a genuine relevance miss, not a depth problem. topK=20's
  result confirms this empirically: zero improvement over topK=16 on
  claim 2, at a real latency cost (below).

### topK=20 costs real latency for zero additional accuracy over topK=16

topK=20's p95 (31,558ms) is the **first real budget overshoot** measured
anywhere in Block 2.5 — over ADR 009's ≤30s p95 estimate — for the same
PASS/FAIL result as topK=16. topK=16's own p50 (19,446ms) and p95
(25,026ms) are, within this run's noise, no worse than topK=12's and
comfortably inside both budgets. topK=20 is strictly dominated: same
accuracy, worse tail latency, more output tokens (1,142 vs 1,005 mean — a
larger context nudges the model toward longer opinions).

## Decision

**Accepted: `COVERAGE_RETRIEVE_TOP_K` 12 → 16, `COVERAGE_RETRIEVE_POOL`
unchanged at 30.** Recovers the one miss that was actually a depth problem
(`III.A.8`), at no measured latency or cost penalty over the original
guess. topK=20 was measured and rejected — it buys nothing further and
costs real p95 headroom.

**`IV.5` (claim 2) is not fixed by this change, and won't be fixed by
raising topK/pool further** — the root-cause check proves the ceiling.
Left as an open, separate problem, not silently accepted: candidate fixes
belong to a different part of the stack — a query-reformation step (ADR
009 explicitly deferred this: "no query-decomposition node... before
there's evidence single-pass retrieval misses a facet" — this is exactly
that evidence, for one case), a reranker (ADR 006 deferred this for the
same "no earned problem yet" reason — same caveat), or accepting it as a
residual limitation the human reviewer's judgment covers (the review queue
exists precisely because the agent isn't meant to be the final word). Not
decided here — recorded as the next block's clearest lead, same posture
ADR 009 took toward this ablation itself.

## Scorecard (§5A factors)

| Factor | Reading |
|---|---|
| Quality | 7/10 → 8/10 PASS, one real miss (`III.A.8`) recovered with a mechanistic explanation, not a guess. The other miss (`IV.5`) is unaffected — correctly so, since it isn't a depth problem |
| Latency | p50 19,446ms vs. 21,221ms (topK=16 slightly *better*, within noise), p95 25,026ms vs. 25,436ms (also slightly better) — no measured cost for the win |
| Cost | Output tokens 1,005 vs. 1,029 mean (flat, within noise); input tokens rise slightly with 4 more passages but retrieval itself stays sub-second regardless of topK (Block 2.5e: `retrieve` p50 0.52s) |
| Complexity | One constant change, already parameterized (Block 2.5e added `retrieve_top_k`/`retrieve_pool` overrides to `run_coverage_agent()` specifically for this ablation) |
| Operational burden | None — no new vendor, no new service |
| Reversibility | Trivial — one constant |

## What would change this

- **A larger/different claim set showing `IV.5`'s miss recurring as a
  pattern** (not just this one case) would be the trigger to actually build
  a fix (query reformation or a reranker) rather than just recording it —
  same "recurs vs. one-off" test ADR 003 applied to the F-123 Q8 regression.
- **If a future accuracy pass shows topK=16 introducing new noise** (a
  chunk-count-driven hallucination, the same failure mode ADR 004's MC0-
  alone cell hit before topK absorbed it) on a larger corpus — this
  ablation's 10-claim sample is small enough that a rare noise case could
  be sitting just past what was measured.
- **If `draft_opinion`'s output size grows materially on real (messier,
  multi-issue) user claims** rather than this golden set's clean
  single-issue claims, both the topK=16 latency numbers and the "no cost"
  conclusion here should be re-checked against that real distribution, not
  assumed to hold.

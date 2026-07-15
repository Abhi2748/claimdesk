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
Left as an open, separate problem, not silently accepted — see the next
section for exactly which fix this evidence does and doesn't support.

## `IV.5` is earned evidence for query reformation specifically — not for a reranker

This is worth being precise about, because the two candidate fixes are not
interchangeable and the full-pool dump above draws a sharp line between
them:

- **A reranker re-scores candidates already in the pool.** ADR 006 deferred
  it for lack of an earned problem — every FAIL on this corpus, until now,
  traced to ranking depth (topK cutoff) or generation, not to the pool's
  *contents*. `IV.5` is a different failure mode: it never enters the
  30-candidate pool in the first place, at any rank, by either signal
  (dense or BM25). **A reranker cannot promote a candidate that was never
  retrieved.** This case doesn't move the reranker decision at all — ADR
  006's "no earned problem yet" stands for it specifically.
- **Query reformation acts before retrieval, not after.** The failure here
  is a vocabulary/semantic gap between the claim's language ("riding lawn
  mower," "attached garage") and the clause's ("self-propelled vehicles or
  machines... not licensed for use on public roads"). A step that expands
  or rewrites the retrieval query — e.g. asking the model to enumerate the
  categories of property/peril a claim touches before retrieving, or
  issuing more than one retrieval pass with reformulated terms — could
  plausibly pull `IV.5` into the pool where a reranker never gets the
  chance. ADR 009 deferred exactly this ("no query-decomposition node...
  before there's evidence single-pass retrieval misses a facet") for lack
  of evidence. **This is that evidence — for one case, not yet a pattern**
  (per "What would change this" below), but it's evidence of the specific
  kind ADR 009 named as the trigger, and it points at query reformation,
  not the reranker, as the fix that could actually reach this failure mode.

Recorded as the next block's clearest lead, not decided here — same
posture ADR 009 took toward this ablation itself. Also not decided here:
accepting `IV.5`-shaped misses as a residual limitation the human
reviewer's judgment covers, which the review queue exists precisely to
catch (the agent isn't meant to be the final word) — a legitimate option
if query reformation turns out not worth its own complexity once measured.

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

- **A larger/different claim set showing `IV.5`-shaped misses (controlling
  clause absent from the full candidate pool, not just past the cutoff)
  recurring as a pattern** would be the trigger to actually build query
  reformation rather than just recording it — same "recurs vs. one-off"
  test ADR 003 applied to the F-123 Q8 regression. A reranker is not on
  this list — the section above explains why it can't reach this failure
  mode regardless of how often it recurs.
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

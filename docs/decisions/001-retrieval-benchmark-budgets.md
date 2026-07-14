# ADR 001 — Latency and cost budgets for the Retrieval Lab v2 benchmark

**Status:** Proposed (first sub-step of Block 2.2). Sets the target the ablation
(baseline → +hybrid → +contextual chunks → +reranker → +router) is measured
against, per the Phase 2 brief's decision-discipline section (§5A).

## Question

Before benchmarking any new retrieval component, what per-query latency and
cost ceiling is a component allowed to spend, and what's the current baseline
it's measured against?

## Measured baseline (frozen F-122 single-doc path)

From `apps/web/eval/results.md` (run 2026-07-13, `claude-sonnet-4-6`, `QA_TOP_K=6`,
`max_tokens=2048`, single retriever = vector-only, 20 questions):

| Metric | Value |
|---|---|
| p50 latency | ~7.4s (median of the 20 logged `latency_ms`) |
| p95 latency | ~9.8s |
| max observed | 13.2s |
| min observed | 2.1s (a refusal — short-circuits before the full generation) |

This is retrieval (`match_chunks`, top-6) + one Claude Sonnet call, no reranker,
no hybrid search, no contextual retrieval — the current live path.

**Cost is estimated, not measured** — this repo doesn't yet log per-call token
usage anywhere queryable outside Langfuse (which is private to the account
owner and wasn't pulled for this ADR). Estimate, to be replaced with real
`usage.input_tokens`/`usage.output_tokens` from Langfuse before the ablation
sub-step locks in:

- Input: 6 passages (~250–400 tokens each) + system prompt + question ≈
  2,500–2,800 tokens.
- Output: `max_tokens=2048` is the cap; observed answers are short citations,
  likely 150–400 actual output tokens.
- At `claude-sonnet-4-6` pricing ($3.00 / $15.00 per MTok input/output): input
  ≈ $0.0075–0.0084, output ≈ $0.0023–0.006 → **~$0.010–$0.014 per query**,
  plus a negligible embedding cost for the question (`text-embedding-3-small`,
  ~$0.02/MTok, OpenAI pricing — a handful of tokens per query, effectively
  free).

**Action before the ablation sub-step:** pull 10–20 real traces from Langfuse
and replace this estimate with measured `usage` figures. Don't gate the
ablation's pass/fail on an estimate.

## Budgets (the target, not just an observation)

- **Latency, per live "Ask the matter" query:** p50 ≤ 8s, p95 ≤ 12s, hard
  timeout 20s. This gives ~2.2s of headroom over the current p95 (9.8s) for
  any new component (hybrid fusion, reranker call, router decision) before it
  must justify pushing the budget itself.
- **Cost, per live query:** ≤ $0.03. Current estimated cost (~$0.012) leaves
  roughly $0.018 of headroom for a reranker call (Cohere Rerank / Voyage
  rerank-2 are typically $0.001–$0.005 for a top-~20 rerank) and any added
  router overhead.
- **Indexing (one-time, not per-query):** tracked separately, not against the
  per-query budget. Contextual Retrieval's per-chunk contextualization call
  should default to a cheap model (`claude-haiku-4-5`, $1.00/$5.00 per MTok)
  rather than the frozen `claude-sonnet-4-6` answerer model, specifically to
  keep one-time indexing cost low — record the actual choice as its own ADR
  when Contextual Retrieval is benchmarked (§5A decision point 3).

## Decision

Adopt the above as the pass bar for Block 2.2's ablation: a component (hybrid
BM25, contextual chunks, reranker, router) is kept only if its measured
accuracy gain (on the golden corpus — F-122 frozen + the new F-123/F-144 sets)
is worth its latency and cost against these budgets, per question type, not
just in aggregate.

## What would change this

- Real Langfuse cost data showing the estimate above is off by more than ~30%
  — replace the estimate, keep the same budget logic.
- If the live product's UX tolerance turns out to be tighter than assumed here
  (e.g. user feedback that 8s already feels slow) — tighten the latency
  budget and re-run the ablation against the new bar.
- If a component's marginal accuracy gain is large enough to justify blowing
  through a budget for specific hard question types only (e.g. reranker helps
  multi-hop questions a lot but adds 1.5s) — the router (2.3) is the
  mechanism to apply it selectively rather than raising the global budget.

# ADR 006 — Skip contextual retrieval and the reranker (for now)

**Status:** Accepted. The Block 2.2 ablation plan (baseline → +hybrid →
+contextual chunks → +reranker → +router, per the Phase 2 brief §5A) stops
after hybrid + the chunking/top-K knobs (ADR 003, ADR 004). Contextual
Retrieval and a cross-encoder reranker are **not built**, not benchmarked
beyond the desk estimate below — the measured bar is already cleared and
neither component's cost is justified against a baseline that isn't
failing.

## Question

The brief's ablation ladder has two rungs left: (3) Contextual Retrieval
(LLM-generated per-chunk context, prepended before embedding) and (4) a
cross-encoder reranker over a wider candidate pool. Do we build and
benchmark them now, per the original ladder, or stop at the current config?

## Where the ladder actually stands

| Stage | PASS/n | SEVERE | p50 latency | avg cost/query | ADR |
|---|---|---|---|---|---|
| Baseline (dense, 50-char, topK=6) | 34/43 (79.1%) | 3 | 6,178ms | $0.00658 | 003 |
| +hybrid (BM25 + RRF) | — (hybrid was the baseline carried into 004) | — | — | — | 003 |
| +chunking (MC0) + topK=10 | **39/43 (90.7%)** | 2 | 6,341ms | $0.00766 | 004 |
| +refusal-string post-check | **41/43 (95.3%)** | **0** | unchanged | unchanged | 005 |

Against ADR 001's budgets (p50 ≤ 8s, p95 ≤ 12s, ≤ $0.03/query): p50 is at
79% of budget, cost is at 26% of budget, and **there are zero SEVEREs left
in either corpus** (43-question ablation corpus and the 20-question frozen
F-122 corpus). The 2 remaining FAILs (`F-122-ABLATION-MC0` Q4, Q18) are
missing-citation cases already root-caused in ADR 004 as chunk-drop-adjacent
retrieval-ranking misses, not hallucination or refusal failures — the
severity floor that actually matters for a legal-document product (never
invent a citation, never fail to refuse) is already at zero.

## Why contextual retrieval and reranking are skipped, not deferred-and-forgotten

Per §5A: *"Do NOT add a component because it's state of the art. Default to
the simplest option that meets the quality bar; add complexity only when
the data proves it earns its place."* The quality bar here is the eval
gate (17/20, 0 SEVERE on frozen F-122) plus the ablation corpus's SEVERE
count. Both are already at their floor (0 SEVERE). Building either
component now would be adding complexity to *chase FAIL count on 2 known,
already-diagnosed misses*, not to fix a quality problem the product
actually has.

**Contextual Retrieval** (Anthropic's technique: prepend an LLM-generated
1–2 sentence context to each chunk before embedding) has a real, non-trivial
cost profile: one extra LLM call per chunk at index time (mitigated by
prompt caching per Anthropic's writeup, but still a new per-document
indexing cost and a new failure mode — what happens when the contextualizer
call fails or hallucinates a misleading context sentence that then biases
retrieval). ADR 004 already found the two knobs it was going to
diagnose-and-fix (chunk-drop, hybrid fusion rank miss) are fully resolved by
MIN_CHUNK_CONTENT_CHARS=0 + topK=10 alone — there's no longer a "chunk
lacks context to be found" failure mode in the corpus for Contextual
Retrieval to fix.

**Reranker** (cross-encoder over a wider pool, e.g. Cohere Rerank / Voyage
rerank-2) adds one API call per query — a new vendor dependency, a new key
to manage, added latency (typically 100–400ms for a top-20 rerank per
published benchmarks), and added per-query cost ($0.001–0.005/query per
ADR 001's estimate). ADR 001 reserved budget headroom specifically for this
($0.018/query of the $0.03 budget was earmarked for reranker + router
overhead) — the headroom exists, but headroom existing isn't a reason to
spend it. With 0 SEVERE and FAIL already down to 2/43 (both root-caused,
not a fuzzy "retrieval quality is bad" problem), a reranker has no clear
failure mode left to fix on this corpus. Its marginal accuracy gain here
would be near-zero to measure against real added latency/cost/complexity.

## Scorecard (§5A factors, decision framed as "build vs. don't")

| Factor | Reading |
|---|---|
| Quality | No measured problem left for either component to solve — 0 SEVERE, 2/43 FAIL (both diagnosed, unrelated to ranking depth or chunk context) |
| Latency | Both would add real, measured latency (reranker ~100–400ms typical; contextual retrieval adds index-time cost only, not query-time) against a p50 that's already using only 79% of budget — spending it on unneeded components leaves less headroom for the one thing still planned (2.3's router) |
| Cost | Reranker adds ~$0.001–0.005/query recurring; contextual retrieval adds a one-time-per-chunk indexing cost. Neither is expensive in isolation, but "cheap so build it anyway" is exactly the instinct §5A asks us to resist |
| Complexity | Reranker = new vendor + new API key + new failure mode (vendor outage, rate limits) in the hot path. Contextual retrieval = new indexing step + a new small-model dependency + a new place a hallucinated context sentence could mislead retrieval |
| Operational burden | Reranker: another vendor to hold a key for, another dependency in the live request path's critical chain. Contextual retrieval: one-time, index-time only — lower operational burden than the reranker if ever revisited |
| Reversibility | Both are additive and cleanly reversible if built later — skipping now costs nothing but the (currently unearned) accuracy gain |

## Decision

**Accepted — skip both, do not build.** The ablation stops at hybrid +
MC0 chunking + topK=10 (ADR 004) + the refusal post-check (ADR 005). The
2.3 router (dense vs. hybrid per question type, already-planned next block)
remains in scope — it's a different kind of component: it doesn't add a new
vendor or a new per-query cost, it chooses between retrievers already built
and measured (ADR 003's dense-vs-hybrid data is exactly its input).

This is not "contextual retrieval and reranking are bad techniques" — both
are legitimate, well-evidenced 2026 techniques (Anthropic reports ~49–67%
retrieval-failure reduction from the combination on their own benchmarks).
It's that *this corpus, at this quality bar, doesn't have the failure mode
they fix*, and adding them without a measured problem to solve is exactly
the anti-pattern §5A warns against.

## What would change this

- **A new document type or question type drives SEVERE or FAIL back up.**
  If Block 2.4 (smarter document extractor) or a future real-policy-form
  addition to the corpus reintroduces chunk-context-dependent failures
  (e.g. a chunk whose meaning depends on a cross-reference to a distant
  section — exactly what Contextual Retrieval targets) or ranking-depth
  misses that topK=10 doesn't reach, that's new evidence, not present in
  today's corpus.
- **The 2.3 router surfaces a systematic weak spot** — e.g. a specific
  question type (multi-hop, cross-section) where even the best single
  retriever underperforms — that a reranker specifically addresses. The
  router's job is partly to find where that is, if it exists.
- **A concrete accuracy floor regression** — e.g. FAIL rate climbing above
  the current 2/43 (4.7%) baseline on any future corpus addition, with a
  root cause that traces to ranking depth or missing chunk context
  specifically (not extraction quality, not a new SEVERE class entirely).
- **A latency/cost budget renegotiation** that frees up more headroom
  specifically earmarked for these components (unlikely — ADR 001's budget
  already has room; the gate is measured need, not available budget).

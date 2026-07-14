# ADR 002 — Retrieval Lab v2 harness design: in-process hybrid, not a DB-level search index

**Status:** Accepted (harness proven on a 5-question / 2-config sample, Block
2.2c). Governs how the retrieval ablation (baseline → +hybrid → +contextual
chunks → +reranker) is measured; does not itself change the live path.

## Question

How should the ablation harness compute hybrid (BM25 + dense) retrieval —
add a Postgres full-text index (`tsvector`/GIN) and a `match_chunks_hybrid`
SQL function, or keep it in-process?

## Options considered

1. **DB-level BM25** — add a `tsvector` column + GIN index to `chunks`, a new
   SQL function doing `ts_rank`/`ts_rank_cd` fused with vector similarity
   server-side (e.g. via a CTE + RRF in SQL).
2. **In-process BM25** (chosen) — fetch each benchmark document's chunks
   once (`id, section_label, page_start, page_end, content` — no embedding
   needed), build a hand-rolled Okapi BM25 index in memory, fuse with the
   *real* `match_chunks_multi` RPC's dense results via Reciprocal Rank
   Fusion (k=60), entirely inside the harness script (`eval/bm25.ts`,
   `eval/retrieval-lab.ts`).
3. **External search service** (Elasticsearch/OpenSearch/Typesense) — out of
   scope; would add a whole new stateful service for a ~300-chunk-per-doc
   corpus.

## Scorecard

| Factor | DB-level BM25 | In-process BM25 (chosen) |
|---|---|---|
| Quality | Same ranking quality (Okapi BM25 either way) | Same |
| Latency | Marginally faster per query (no round-trip for chunk fetch) | One extra one-time fetch per doc (cached before the timing loop — **zero per-query cost**, matches how a real index would behave) |
| Complexity | New migration, new SQL function, index maintenance on every chunk write | Zero schema changes; ~90 lines of TS, isolated to `eval/` |
| Reversibility | A migration — needs a down-migration to undo | Delete two files |
| Risk to frozen path | Touches `chunks` DDL and adds a new RPC alongside `match_chunks`/`match_chunks_multi` — any mistake here is a shared-schema risk | Zero risk — the harness only *reads* `chunks` and calls the existing, unmodified `match_chunks_multi` |
| Corpus fit | Built for scale (thousands+ of docs) | Fits a ~300–400 chunk/doc, 3-doc benchmark corpus exactly; would need revisiting past maybe 10k chunks/doc |

## Decision

Keep BM25 and RRF fusion entirely in-process for the ablation harness. The
corpus is small enough (296–314 chunks/doc across 3 documents) that an
in-memory inverted index costs nothing measurable, and it means the harness
can be deleted or rewritten without touching the database at all — the
lowest-risk way to explore the hybrid config while `chunks`/`match_chunks*`
stay untouched per the frozen-path rule.

Dense retrieval, in every config (including `hybrid`), goes through the
*real* `match_chunks_multi` RPC — never a hand-rolled cosine computation —
so the "dense" half of every measurement is bit-for-bit what production
would return, not an approximation of it.

The refusal gate (`REFUSAL_SIMILARITY_THRESHOLD = 0.35`) is evaluated
identically across configs, using the dense pool's top-1 similarity. That
threshold was calibrated specifically against `text-embedding-3-small`
cosine scores (`lib/retrieval-config.ts`); changing what feeds the gate is a
separate decision from ranking, out of scope for this ablation.

## Harness-proof result (5 questions, 2 docs sampled round-robin, `dense` vs
`hybrid`, real API calls — not simulated)

| config | n | PASS | FAIL | SEVERE | p50 latency | p95 latency | avg cost/query |
|---|---|---|---|---|---|---|---|
| dense | 5 | 4 | 1 | 0 | 5,974ms | 7,456ms | $0.00510 |
| hybrid | 5 | 5 | 0 | 0 | 3,343ms | 5,122ms | $0.00443 |

n=5 is far too small to conclude "hybrid wins" — but the one FAIL→PASS flip
(F-144 Q1, a question the 2.2b build-log findings already flagged as a
retrieval-ranking miss: expected `V.D.5`, dense-only missed it) is exactly
the failure mode hybrid is supposed to fix, on the first real question drawn
from that finding. That's the harness doing its job, not yet a verdict on
the config.

Real per-query cost (~$0.0044–0.0051) is roughly 40% below the ADR 001
*estimate* (~$0.010–0.014) — driven mostly by shorter observed output
generations (52–304 tokens vs. the estimated 150–400 ceiling) on these
particular questions. Not yet enough samples to replace the ADR 001 budget
baseline; that happens after the full sweep.

## What would change this

- If a future block needs cross-document or cross-case full-text search at
  product scale (not a benchmark harness), that's a real case for a DB-level
  `tsvector` index — revisit then, as its own ADR with its own scorecard.
- If per-doc chunk counts grow past what fits comfortably in memory for a
  single benchmark run (order of 10k+/doc), move the BM25 index build
  server-side.

# ADR 004 — MIN_CHUNK_CONTENT_CHARS and top-K: a 2x2 ablation

**Status:** Accepted — MIN_CHUNK_CONTENT_CHARS=0 and topK=10 are adopted
**together** as the base config for the remaining ablation legs (contextual
chunks, reranker). Neither knob wins cleanly alone; combined, they do.
**Not wired into the live path.** `lib/qa/pipeline.ts`, `apps/ai`, and
`lib/retrieval-config.ts` (`QA_TOP_K = 6`) are unchanged; `chunkPolicyText`'s
default (`MIN_CHUNK_CONTENT_CHARS = 50`) is unchanged for every existing
caller — the override is opt-in via an env var only the new ablation ingest
script sets. The live/frozen F-122 document was never touched.

## Question

ADR 003 flagged two of the eval's four remaining SEVEREs as chunk-drop
artifacts — a real section of the source document (e.g. `II.B.1.C`) has no
chunk of its own because it fell under the 50-char `MIN_CHUNK_CONTENT_CHARS`
floor, so it can never be cited correctly. ADR 003 also root-caused the one
hybrid regression (F-123 Q8) to a fused rank of 8, two short of the topK=6
cutoff, and predicted a topK=8–10 config would likely recover it. This leg
tests both predictions and asks: do they interact, and does either cost
anything in latency, cost, or new noise?

## Method

New document rows only — the live F-122 (`e11b7bdf-...`) and the 50-char
`F-122-ABLATION`/`F-123`/`F-144` rows used by ADR 003 are untouched. Fresh
copies of all 3 benchmark PDFs were re-chunked and re-embedded with
`MIN_CHUNK_CONTENT_CHARS=0` (`scripts/ingest-minchunk0.ts`, `CHUNK_MIN_CONTENT_CHARS`
env override in `chunk-policy.ts`, unset everywhere else) under new titles/ids,
recorded as `F-122-ABLATION-MC0` / `F-123-MC0` / `F-144-MC0` in
`eval/documents.json` (existing keys preserved, not overwritten).

A 2x2 sweep, hybrid retriever only (per ADR 003, hybrid is the current base
config), all 43 golden questions per cell, real API calls throughout:

| | topK=6 | topK=10 |
|---|---|---|
| **50-char chunking** | A — reused from ADR 003 | B — new |
| **0-char (MC0) chunking** | C — new | D — new |

`eval/retrieval-lab.ts` was extended with the MC0 doc targets (same golden
files — the questions target document content, not chunk boundaries) and a
`LAB_OUT` env var so the 3 new sweeps didn't clobber each other's results.
Full row-level data: `eval/retrieval-lab-results.md` (A),
`eval/sweep-b-baseline-topk10.md`, `eval/sweep-c-mc0-topk6.md`,
`eval/sweep-d-mc0-topk10.md`; combined leaderboard in
`eval/chunking-topk-leaderboard.md`.

## Result

| cell | chunking | topK | PASS | FAIL | SEVERE | p50 ms | p95 ms | avg cost/q | total cost |
|---|---|---|---|---|---|---|---|---|---|
| A: baseline | 50-char | 6 | 34 (79.1%) | 6 | 3 | 6,178 | 8,922 | $0.00658 | $0.28298 |
| B: baseline+topK10 | 50-char | 10 | 36 (83.7%) | 4 | 3 | 6,422 | 9,732 | $0.00801 | $0.34463 |
| C: MC0+topK6 | 0-char | 6 | 36 (83.7%) | 4 | 3 | 6,165 | 8,846 | $0.00629 | $0.27054 |
| D: MC0+topK10 | 0-char | 10 | **39 (90.7%)** | **2** | **2** | 6,341 | 8,781 | $0.00766 | $0.32935 |

Chunk counts: 0-char chunking produces ~29% more chunks than 50-char
(F-122-ABLATION 314→408, F-123 296→381, F-144 306→391) — every dropped stub
becomes a retrievable, citable chunk.

### Six questions changed status; D is a strict superset of every individual win, zero regressions

| doc / Q | A (baseline) | B (topK10) | C (MC0) | D (MC0+topK10) |
|---|---|---|---|---|
| F-122-ABL Q10 | FAIL | FAIL | **PASS** | **PASS** |
| F-122-ABL Q16 (mudflow/landslide trap) | FAIL | **PASS** | FAIL | **PASS** |
| F-123 Q8 (the ADR 003 regression) | FAIL | **PASS** | **PASS** | **PASS** |
| F-123 Q12 (chunk-drop SEVERE) | SEVERE | SEVERE | **PASS** | **PASS** |
| F-144 Q7 | PASS | PASS | **FAIL** | **PASS** |
| F-144 Q9 | FAIL | FAIL | **SEVERE (worse)** | **PASS** |

All other 37 of 43 questions are unchanged across all 4 cells.

## Reading each knob

**topK=10 alone (B vs. A): a clean, no-downside win, but doesn't touch chunk-drop.**
Recovers F-123 Q8 exactly as ADR 003 predicted (fused rank 8 now fits inside
a 10-cutoff) and, as a bonus, F-122-ABL Q16 — the corpus's hardest trap
question. Zero regressions. But `F-123 Q12` stays SEVERE: the missing
`II.B.1.C` chunk literally doesn't exist in the 50-char index, so no cutoff
size can retrieve it. topK is a ranking-headroom fix, not a coverage fix.

**MIN_CHUNK_CONTENT_CHARS=0 alone (C vs. A): fixes the SEVERE it was built to
fix, but is not a clean win — it trades one failure mode for a different one.**
`F-123 Q12`'s chunk-drop SEVERE resolves to PASS exactly as intended, plus
two side wins (`Q10`, `Q8` — smaller chunk boundaries apparently also
reshuffled BM25/dense rankings favorably). But `F-144 Q7` regresses
(PASS→FAIL) and, worse, `F-144 Q9` regresses from a plain FAIL to a **new**
SEVERE — the model invents a citation (`V.D.3.A`) that isn't real. This is
exactly the risk the block brief called out: more, smaller chunks add
retrieval noise (a sub-clause stub scoring artificially high on a short,
keyword-dense match) even as they close the chunk-drop gap. Net for C is
still positive (+2 PASS/−2 FAIL/0 SEVERE net vs. A — same aggregate as B)
but for a materially different, less clean reason: real trade, not a strict win.

**Both together (D): the trade C introduced is exactly what B's extra
headroom absorbs.** Every MC0 chunking win survives, and both of C's
regressions resolve at topK=10 — `F-144 Q7` gets its correct citation back,
and `F-144 Q9`'s hallucinated `V.D.3.A` is displaced entirely once 4 more
candidate slots are available (the correct `V.D.5` passage makes the cut
instead of getting crowded out). Net: **5 wins, 0 regressions** — a strict
superset of every individual cell's wins. The two knobs are complementary,
not redundant: one closes a coverage gap the other can't reach, and the
other absorbs a noise cost the first one introduces alone.

### The 2 remaining SEVEREs are pure refusal-string-exactness, not retrieval

Both `F-123 Q13` and `F-144 Q10` fail identically at every cell in this
sweep: `must_refuse question received substantive answer` — the model
answers a should-refuse question with hedging prose instead of the exact
`REFUSAL_MESSAGE` string. Same root cause ADR 003 already flagged. **After
this leg, zero remaining SEVEREs trace to retrieval or chunking** — the
retrieval/chunking axis of the ablation is now exhausted for this corpus;
what's left is a generation/prompt-adherence fix, out of scope for a
retrieval ablation.

## Scorecard (§5A factors, for the combined D config vs. A baseline)

| Factor | Reading |
|---|---|
| Quality | 34→39 PASS (+14.6 pts), 6→2 FAIL, 3→2 SEVERE, and the 2 SEVEREs left are unrelated to retrieval. Larger, cleaner effect than ADR 003's hybrid-vs-dense result (5 flips there vs. 6 here, and this one has zero regressions where hybrid-vs-dense had one) |
| Latency | p50 6,178ms→6,341ms (+163ms, within run-to-run noise — C's p50 was *lower* than A's), p95 8,922ms→8,781ms (slightly better). Both comfortably inside the ADR 001 budget (p50 ≤ 8s / p95 ≤ 12s) |
| Cost | $0.00658→$0.00766/query (+16%), still 4x under the ADR 001 budget ($0.03/query). The MC0 index itself is nearly free to build: ~$0.0004/doc extra embedding spend for ~29% more chunks (measured: $0.00037/$0.00033/$0.00035 per doc, all sub-cent) |
| Complexity | topK is a one-line config bump. MIN_CHUNK_CONTENT_CHARS=0 is a one-line default change plus a re-ingest of every existing document (one-time backfill cost if ever promoted to the live path — not evaluated here) |
| Operational burden | None — no new vendor, no new service. Larger chunk tables (~29% more rows) is the only footprint change |
| Reversibility | Trivial for the ablation (env var, unset everywhere else). Reversing on the live path would mean re-ingesting every document again — cheap per-doc but non-instant at scale |

## Decision

**Accepted.** MIN_CHUNK_CONTENT_CHARS=0 and topK=10 become the base config
for the remaining Block 2.2 ablation legs (contextual chunks, reranker),
replacing ADR 003's topK=6/50-char hybrid baseline. The case for adopting
both together, not either alone: B alone leaves a real SEVERE unfixed by
construction (no chunk = no citation, regardless of cutoff); C alone trades
that SEVERE for a *different* SEVERE (chunk-noise hallucination) plus a
regression; D is the only cell with zero regressions and the best result on
every quality metric, at a cost/latency delta well inside budget.

**Not a decision to touch the live path yet** — same posture as ADR 003.
`QA_TOP_K` stays 6, `MIN_CHUNK_CONTENT_CHARS` stays 50 for every existing
document and ingest path; promoting either requires a live re-ingest
(one-time backfill) that's out of scope for an ablation-harness change.

## What would change this

- If the reranker leg (once a vendor key exists) can recover the same wins
  without the topK increase — i.e., clean up MC0's noise-chunk problem via
  relevance re-scoring instead of raw cutoff size — that's a stronger
  argument for reranker + MC0 over topK10 + MC0 (less generation-prompt
  context, likely lower per-query cost at the margin).
- Confirm the `F-144-MC0` regressions at topK=6 (C) aren't just this
  particular corpus's quirk — if a larger/different document set shows the
  same "more chunks → more hallucination risk at fixed topK" pattern, that's
  evidence MIN_CHUNK_CONTENT_CHARS=0 should ship *only* paired with a topK
  increase (or a reranker), never alone.
- If a future contextual-chunking leg (prepending LLM-generated context per
  chunk) also reduces noise at small chunk sizes, that could substitute for
  the topK increase's noise-absorption role at a different cost/latency
  trade-off — worth comparing once that leg runs.
- The refusal-string-exactness SEVEREs (`F-123 Q13`, `F-144 Q10`) are now the
  only remaining SEVEREs in the corpus. Worth its own small fix (prompt
  tightening around the exact refusal string) before or alongside the next
  retrieval leg — cheap, and would push the ceiling from 2 SEVERE to 0 on
  this cell.

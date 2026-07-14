# ADR 003 — Hybrid (BM25 + dense) retrieval: full-sweep ablation result

**Status:** Accepted, with caveat — hybrid is the base config for the
remaining ablation legs (contextual chunks, reranker). The caveat: the
F-123 Q8 regression (root-caused below) is logged as evidence that Block
2.3's per-question router — not a blanket "always hybrid" rule — is likely
the right shape for the live product. **Not wired into the live path** —
`lib/qa/pipeline.ts` and `apps/ai` still call `match_chunks`/
`match_chunks_multi` alone, unchanged.

## Question

Does adding a BM25 (keyword) signal, fused with dense vector search via
Reciprocal Rank Fusion, measurably improve retrieval quality over dense
alone — and does it earn its cost per the Block 2.2 ablation discipline
(§5A: keep a component only if its measured gain justifies its
latency/cost)?

## Method

Full sweep, all 43 golden questions across the reproducible 3-doc benchmark
corpus (F-122-ABLATION 20Q, F-123 13Q, F-144 10Q — **not** the frozen live
F-122 doc/gate), `dense` vs `hybrid`, topK=6, hybrid candidate pool=20/side,
RRF k=60. Real API calls throughout (see ADR 002 for harness design). Every
row real-scored by the same `scoreQuestion` logic the frozen eval uses.

## Result

| config | n | PASS | FAIL | SEVERE | p50 latency | p95 latency | p50 retrieval-only | avg cost/query | total cost |
|---|---|---|---|---|---|---|---|---|---|
| dense | 43 | 32 (74.4%) | 7 | 4 | 6,227ms | 8,701ms | 213ms | $0.00643 | $0.27640 |
| hybrid | 43 | 34 (79.1%) | 6 | 3 | 6,178ms | 8,922ms | 204ms | $0.00658 | $0.28298 |

By document:

| doc | dense P/F/S | hybrid P/F/S |
|---|---|---|
| F-122-ABLATION (20Q) | 15/4/1 | 16/4/0 |
| F-123 (13Q) | 11/0/2 | 10/1/2 |
| F-144 (10Q) | 6/3/1 | 8/1/1 |

### What actually flipped (5 of 43 questions changed status)

| doc / Q | dense | hybrid | Read |
|---|---|---|---|
| F-122-ABL Q13 (Property Not Insured, swimming pool) | FAIL | PASS | **Win** — dense top-6 missed IV.14; hybrid's BM25 signal (exact keyword match on "swimming pool"/"pump") surfaced it. |
| F-122-ABL Q16 (mudflow vs. landslide, the hardest trap question) | SEVERE (invented `II.B.1.C`) | FAIL (missing `V.C`/`II.C.20`) | **Partial win** — hybrid stopped the invented citation but still didn't retrieve the right passages. Downgraded a SEVERE to a FAIL, not a PASS. |
| F-123 Q8 (basement personal property) | PASS | FAIL | **Regression** — the one case hybrid made worse. BM25's keyword pull apparently displaced the correct dense-ranked chunk from the fused top-6. |
| F-144 Q1 (flood definition, I.A cite) | FAIL | PASS | **Win** — same failure mode 2.2b already flagged for this exact question. |
| F-144 Q7 (RCBAP building coverage, VIII.R.2.b) | FAIL | PASS | **Win** — another keyword-driven recovery of a near-miss dense ranking. |

Net across the corpus: **+2 PASS, −1 FAIL, −1 SEVERE**, one real regression
mixed into three real wins.

### The 4 remaining SEVEREs are not retrieval-ranking failures

All four SEVERE results — 2 in dense, 2 shared by both configs — trace to
two root causes 2.2b already identified, **neither fixable by re-ranking**:

1. **`MIN_CHUNK_CONTENT_CHARS = 50` chunk-drop** (F-122-ABL Q16 dense,
   F-123 Q12 both configs): the model cites `II.B.1.C`, which is real text
   in the source document but has no chunk of its own (dropped as a
   sub-50-char stub) — so it doesn't exist in `validSections` for *either*
   config, because neither config's index contains it. This needs the
   chunking-knob leg of the ablation, not a ranking fix.
2. **Refusal-string-exactness** (F-123 Q13, F-144 Q10, both configs): the
   model answers a `must_refuse` question with a hedging/explanatory
   sentence instead of the bare `REFUSAL_MESSAGE` string. Purely a
   generation/prompt-adherence issue, orthogonal to which chunks were
   retrieved.

## Root cause: the F-123 Q8 regression

Diagnostic re-run of retrieval only for this one question (no generation
call — free), dumping the full dense top-20, BM25 top-20, and fused
rankings.

Question: *"Who can be the named insured for the personal property coverage
on this policy, and can a condominium association insure jointly-owned
property under it?"* `must_cite: III.B.1`.

The target chunk tree: `III.B.1` (parent, "If you have purchased personal
property coverage..."), `III.B.1.a` ("Owned solely by you, or... the
condominium association..."), `III.B.1.b` ("Owned in common by the unit
owners..."). Citing any of the three satisfies `must_cite: III.B.1` (the
scorer matches on a word-boundary prefix).

| chunk | dense rank (of 20) | BM25 rank (of 20) | fused rank |
|---|---|---|---|
| `III.B.1.b` (id 4878) | **5** | 15 | **8** — 2 short of the top-6 cutoff |
| `III.B.1.a` (id 4877) | 12 | 8 | 9 |
| `III.B.1` (id 4876) | 20 | 16 | 12 |

**Dense's top-6 included `III.B.1.b` at rank 5** — that's what let dense
answer correctly. **Hybrid's fused top-6 contained zero `III.B.1*` chunks**
— `III.B.1.b` was bumped from fused-rank-would-be-good to fused-rank-8 by
two chunks that out-ranked it on BM25 alone:

| chunk | dense rank | BM25 rank | why BM25 overweighted it |
|---|---|---|---|
| `III.B.3` — "coverage will be either for household... or other than household personal property" (id 4880) | 9 | 5 | shares "personal property," "insures," "coverage," "condominium" with the query — topically adjacent (same Coverage-B subsection) but answers a *different* question (property category, not who's insured) |
| `III.B.3.b` — "furniture and fixtures... machinery... stock" (id 4882) | 17 (near the bottom of the dense pool) | **1** | same shared-vocabulary effect, even stronger — BM25's #1 pick was a poor dense match |

This is BM25's known weakness on dense, jargon-repetitive legal/policy text:
adjacent subsections of the same coverage clause (III.B.1 through III.B.9)
reuse the same specialized vocabulary ("personal property," "condominium
association," "insures," "coverage") densely, so raw term-frequency scoring
can't distinguish "which subsection is topically on-point" from "which
subsections use the shared jargon most densely." Dense embeddings *did*
make that distinction correctly here (rank 5, not top-1, but comfortably
inside a 6-cutoff) — equal-weight RRF let a lexically-noisy BM25 signal
override a semantically-correct dense one.

**Is it a fixable fusion detail?** Hand-checked both knobs already on the
roadmap before proposing any new work:

- **RRF's `k` parameter alone doesn't reliably fix it.** At k=10 (more
  rank-sensitive), `III.B.3.b`'s BM25 rank-1 dominates even harder
  (fused score 0.128 vs. `III.B.1.b`'s 0.107) — worse, not better. At
  k=200 (much flatter), the two nearly tie (0.00959 vs. 0.00953) — not a
  clean fix, just noise. Retuning k is not the lever.
- **The already-planned top-k knob likely *would* fix this specific case**
  — `III.B.1.b` missed the cutoff by only 2 positions (fused rank 8 vs.
  cutoff 6); a topK=8–10 config would probably have included it. That's
  direct motivation for running the top-k knob leg next, not a new
  workstream.
- **A dense-weighted fusion (trust dense more than BM25 in the linear
  combination, rather than RRF's implicit equal weighting) is the other
  plausible fix** — dense was right here; equal-weight fusion is what let
  BM25 override it. Worth testing if the router (2.3) needs a single fused
  retriever rather than a discrete choice between dense/hybrid.

**Read:** this is a real, mechanistically-understood dense-vs-keyword
tradeoff (BM25 rewarding shared-vocabulary density over topical precision
on adjacent, jargon-heavy subsections), not a bug in the RRF
implementation — but it's not *inherent and unfixable* either; both the
top-k knob and fusion-weighting levers already on the roadmap are plausible
mitigations, worth checking when those legs run rather than as a special
fix for this one question.

## Scorecard (§5A factors)

| Factor | Reading |
|---|---|
| Quality | +2 PASS / −1 FAIL / −1 SEVERE net over 43 questions (dense 74.4%→hybrid 79.1%). Real, but a small-N result (43 Qs, 5 flips) — not statistically overwhelming; directionally positive and mechanistically explicable (keyword recall catching near-miss dense rankings) |
| Latency | p50 total 6,227ms→6,178ms (dense marginally *slower*, within noise); p50 retrieval-only 213ms→204ms. **No measurable latency cost** — BM25 is in-memory and RRF fusion is O(pool size), both far under 1ms; the only "extra" step is one more `match_chunks_multi` call at a bigger `match_count`, not a materially different query |
| Cost | $0.00643→$0.00658/query (+2.3%), inside the noise of per-question generation-length variance, not a systematic hybrid tax — hybrid's only true marginal cost is CPU, which isn't billed |
| Complexity | One new in-memory BM25 index + one fusion function (ADR 002); no schema change, no new service |
| Operational burden | None — no new vendor, no new infra |
| Reversibility | Trivial — delete the harness files, or just don't wire hybrid into the router |

## Decision

**Accepted, with caveat.** Hybrid earns its keep at effectively zero
latency/cost cost (+2 PASS/−1 FAIL/−1 SEVERE, no measurable latency or cost
delta) and becomes the base config for the remaining ablation legs
(contextual chunks, reranker) rather than re-running each leg against dense
alone.

**The caveat, backed by the F-123 Q8 root-cause above:** hybrid is not a
strict win, and the one regression is a real, mechanistically-understood
dense-vs-keyword tradeoff (BM25 rewarding shared-jargon density over
topical precision on adjacent policy subsections) — not noise, and not
(by itself) a bug to patch in the fusion function. That's direct evidence
that Block 2.3's per-question router — not a blanket "always hybrid" rule —
is the right shape for the live product: dense alone got Q8 right; hybrid
alone got three other questions right that dense missed. A router that
picks per question (or a reranker that cleans up hybrid's false-positive
keyword pulls) is a stronger design than committing to one retriever
globally.

**Not a decision to touch the live path yet.** `match_chunks`/
`match_chunks_multi` and `lib/qa/pipeline.ts` stay exactly as they are;
this only changes what the *ablation* uses as its next baseline.

## What would change this

- The top-k knob leg (topK=8–10) is likely to recover the Q8 regression on
  its own — `III.B.1.b` missed the fused cutoff by only 2 positions. If it
  does, and doesn't cost meaningfully more in latency/tokens, that raises
  the case for a slightly larger cutoff over routing complexity.
- If the F-123 Q8 pattern (BM25 out-ranking dense on adjacent,
  jargon-repetitive subsections) recurs elsewhere in the corpus rather than
  being a one-off, that strengthens the router case; if it doesn't recur,
  weakens it.
- If the reranker leg (once a vendor key is available) recovers Q8 without
  losing the 3 hybrid wins, that's a stronger case for "always hybrid,
  reranker cleans up the rest" over "route between dense and hybrid."
- A dense-weighted fusion (trusting dense more than BM25 in the linear
  combination, rather than RRF's implicit equal weighting) is an untested
  alternative to both the router and the reranker — worth a quick check
  before building either.
- More golden questions (the corpus is only 43) would tighten the
  confidence interval on the +2/−1/−1 read.

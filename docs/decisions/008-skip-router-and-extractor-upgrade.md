# ADR 008 — Skip Block 2.3 (retrieval router) and Block 2.4 (smarter extractor)

**Status:** Accepted. Proceed directly to Block 2.5 (coverage agent). Neither
Block 2.3 nor Block 2.4 has a measured problem to solve as of ADR 007's live
shipment.

## Question

The Phase 2 brief's block order is 2.3 (hybrid retrieval router) → 2.4
(smarter document extractor) → 2.5 (coverage agent). Do 2.3 and 2.4 still
have an earned problem to solve now that ADR 007 has shipped hybrid + MC0
chunking + topK=8 to the live path at 41/43 PASS, 0 SEVERE — or does building
them now mean adding complexity §5A explicitly warns against ("do NOT add a
component because it's state of the art... add complexity only when the data
proves it earns its place")?

## 2.3 — retrieval router: the motivating case is already resolved

The router's only concrete evidence was ADR 003's F-123 Q8 regression:
dense alone answered it correctly, hybrid alone did not, because the correct
chunk (`III.B.1.b`) missed hybrid's fused top-6 cutoff by 2 positions. ADR
003 flagged that as "direct evidence... a router... is the right shape,"
contingent on the top-k knob *not* fixing it on its own.

ADR 004 tested that contingency directly: topK=10 recovered F-123 Q8 exactly
as predicted, with zero regressions, as part of the combined MC0+topK=10
config (39/43 → 41/43 after ADR 005's refusal fix). ADR 007 shipped that
config live (topK=8 after the latency mitigation) and measured 41/43 PASS,
0 SEVERE on the real Render deployment — including F-123 Q8's fix, confirmed
live, not just in the harness.

**There is no remaining case in either corpus where a single retriever
(hybrid) loses and switching retrievers would help.** The router's entire
justification was resolved by a cheaper, already-shipped knob. Building a
router now would mean adding a per-question routing decision (new latency,
new failure mode: what does it route on, and what happens when the router
itself is wrong) to chase a problem that no longer exists in the data.

## 2.4 — smarter extractor: the current parser already extracts perfectly

Block 2.4's stated purpose (kickoff brief §5) was to benchmark the current
rules-based parser against Docling/VLM "on our own docs, pick by measured
extraction accuracy" — using the new multi-document corpus specifically to
stress-test it with real-world form diversity.

That stress test already ran, as a side effect of Block 2.2b's ingest:

| Form | chunks | pages | labeled_ratio | pages_detected |
|---|---|---|---|---|
| F-122 (frozen control) | — | — | (established baseline) | — |
| F-123 | 296 | 27 | **1.000** | 27/27 |
| F-144 | 306 | 28 | **1.000** | 28/28 |

Both real public policy forms parsed with 100% section-label coverage and
full page detection — no stub chunks, no page-footer misdetection, identical
clean-parse quality to the frozen F-122 control (build log, Block 2.2b).
Every FAIL/SEVERE found across ADR 003/004/005 traces to retrieval ranking,
the chunk-drop config knob, or refusal-string exactness — **none trace to a
mis-parsed section, a missed page, or garbled extraction.** A doc-AI/VLM
parser has no accuracy gap to close on this corpus; it would add a new
vendor/self-hosted dependency, per-page cost, and data-residency questions
(per §5A's own operational-burden factor) to fix a problem that doesn't
exist.

## Scorecard (§5A factors, "build vs. don't" for both)

| Factor | Router (2.3) | Extractor (2.4) |
|---|---|---|
| Quality | No measured case left where hybrid loses to dense | 100% labeled_ratio on both new real-world forms; 0 extraction-attributable failures anywhere in the corpus |
| Latency | Would add a per-query routing decision to a path already at ~95% of its 8s p50 budget (ADR 007) | N/A (indexing-time only), but self-hosting a VLM/Docling pipeline adds real indexing latency for zero accuracy gain here |
| Cost | New routing-decision cost (a classifier call or heuristic) for no measured benefit | New vendor/API or self-hosted GPU cost for no measured benefit |
| Complexity | New routing logic + a new failure mode (router picks wrong) | New parser dependency, new failure mode (VLM misreads a scanned page) |
| Operational burden | None avoided by skipping | Self-hosted Docling = new infra; VLM API = new vendor/key/data-residency question — all avoided by skipping |
| Reversibility | N/A — not built | N/A — not built |

## Decision

**Accepted — skip both, proceed to Block 2.5.** This mirrors ADR 006's
framing exactly: not "these are bad techniques," but "this corpus, at this
quality bar, doesn't have the failure mode they fix," and building either
without a measured problem is the anti-pattern §5A warns against. The
kickoff brief's block *order* (2.3 → 2.4 → 2.5) was written before the
ablation ran; the ablation's own results (ADR 003/004/007) are what should
drive sequencing now, and they point past both.

## What would change this

- **Router (2.3):** a systematic single-retriever weak spot resurfacing —
  e.g. the coverage agent's broader per-claim retrieval (wider topK, more
  varied claim language than the golden Q&A's narrow questions) exposes a
  question type where hybrid consistently underperforms dense (or vice
  versa). The coverage agent's own retrieval step is a natural place this
  evidence would surface, if it exists.
- **Extractor (2.4):** a new document type breaks the rules-based parser —
  e.g. a scanned/image-only policy form, a non-standard section-numbering
  scheme, or a form with tables/riders the current parser doesn't handle. All
  3 forms benchmarked so far are clean, well-structured text PDFs; that's a
  real limit on what this evidence covers, not a claim that the parser
  handles every possible policy format.

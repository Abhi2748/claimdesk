# ADR 009 — Coverage agent: 4-node LangGraph, background-job budget

**Status:** Accepted. Block 2.5e ran a 10-claim golden set against the real
graph (real retrieval, real Anthropic calls) and pulled a real per-node
latency breakdown from the Langfuse spans Block 2.5d added. Unlike ADR 007's
topK 10→8 — a real, necessary correction — this estimate held up: p50
landed at 20.1s against the ≤20s estimate (a 0.6% difference, inside
measurement noise for n=10, not a budget bust) and p95 at 27.8s against the
≤30s estimate. **No knob correction applied.** Full numbers and reasoning in
"Real measurement (Block 2.5e)" below. A separate, real finding did surface
during this run — a reproducible retrieval-coverage gap on 2/10 claims — but
it's an accuracy question, not a latency/budget one; recorded in its own
section rather than folded into this decision.

## Question

Block 2.5 (coverage agent) has two decisions the brief's §5A discipline
requires evidence for before building: (1) how many LangGraph nodes does a
structured, cited coverage opinion actually need, and (2) what latency/cost
budget should it be measured against, given it does materially more work
than the single-question live path that's already at ~95% of its own 8s
budget (ADR 007: p50 7,576ms of an 8s target).

## Why this can't reuse the live Q&A budget

ADR 001's 8s/12s/$0.03 budget was set for one retrieval + one generation
call answering one question, synchronously, blocking a page render. ADR 007
shipped that at p50=7,576ms — thin remaining headroom. A coverage opinion
does retrieval once but generates a materially larger structured output
(multiple findings, each with a citation and rationale, vs. one short
answer) and adds a verification pass. Forcing that into the existing
synchronous budget would mean silently shrinking the opinion (fewer
findings, shorter rationale) to fit a budget set for a different job.

**Decision: run it as a background job**, not a request the UI blocks on.
"Generate coverage opinion" returns immediately; the result appears in the
review queue when the graph finishes (poll or a status flag on the queue
row — no new transport needed). This decouples its budget from the live
Q&A budget entirely, which is what makes a materially higher budget
defensible rather than a scope creep of ADR 001.

## Graph shape: 4 nodes

```
retrieve → draft_opinion → verify_and_score → write_review_queue
```

1. **`retrieve`** — the hybrid retrieval already shipped in ADR 007
   (`retrieve_hybrid()`, extracted in Block 2.5a), against the matter's
   full document set.
2. **`draft_opinion`** — one Sonnet call, forced structured output (tool-use
   schema) producing the full opinion in a single pass.
3. **`verify_and_score`** — deterministic, no LLM call: a structural check
   (does the cited section exist in the retrieved set — a Python port of
   `apps/web/lib/qa/verify.ts`, same pattern as ADR 007's BM25 port) plus a
   grounding score (embedding cosine similarity between each finding's
   rationale and its cited chunk, reusing retrieval's already-computed
   embeddings — no new API call).
4. **`write_review_queue`** — persist the opinion and insert a
   `review_items` row (`kind='coverage_analysis'`, already anticipated by
   migration 014's check constraint, unused until now), `status='pending'`
   always — never auto-approved.

## What was deliberately left out, and why

Per §5A ("add complexity only when the data proves it earns its place") and
consistent with ADR 006/008's framing — none of these are ruled out forever,
they're unbuilt because nothing yet shows the 4-node graph fails without
them:

- **No query-decomposition node.** Single retrieval pass, query built from
  the claim/matter description plus a fixed instruction. Splitting into
  per-facet (coverage/conditions/exclusions) retrieval calls adds a node and
  cost before there's evidence single-pass retrieval misses a facet.
- **No LLM-as-judge grounding node.** Embedding similarity + the structural
  check is free (reused embeddings) and is the same mechanism the product
  already ships for the Q&A verifier badge. An LLM-as-judge pass would
  double per-opinion Sonnet cost for an unmeasured precision gain.
- **No retry/self-correction loop.** Low-grounding findings surface to the
  human reviewer, not to an agentic re-draft — a retry loop doubles
  worst-case latency/cost to fix a problem not yet shown to exist.
- **No routing node.** ADR 008 found no earned problem for a retriever
  router on the existing corpus; always-hybrid (ADR 007's shipped config) is
  the retrieval step here too.

LangGraph's actual payoff over a plain function chain: checkpointed state
(a Sonnet timeout or process restart resumes from the last completed node
instead of re-paying for retrieval) and per-node Langfuse tracing, extending
`observability.py`'s existing fail-open context-manager pattern.

## Known property: generation non-determinism (recorded, not fixed)

`apps/ai/app/services/anthropic.py` pins no `temperature` or seed, so
`draft_opinion`'s Sonnet call — like every generation call in this
service — is not deterministic run-to-run. Observed directly during 2.5a's
verification: rerunning ADR 007's 43-question harness against the
refactored-but-behaviorally-identical retrieval produced one hallucinated
citation (`III.D.8.A`, a subsection that doesn't exist in the document) on
a question ADR 007's own measurement run had answered cleanly; 3 isolated
reruns of that exact question came back clean with byte-identical retrieved
chunks each time, confirming retrieval is deterministic and the flip is
generation-sampling noise, not a retrieval defect.

Practical implications for this ADR: (1) every latency/cost/accuracy number
here and in ADR 001/003/004/007 is a sample, not a constant — a rerun can
land a different count on the margin from generation variance alone, with
retrieval held fixed; large aggregate deltas (e.g. ADR 004's 34→39 PASS)
are far bigger than this noise floor and stay trustworthy, but a single
flipped question near a threshold shouldn't be over-read without a rerun.
(2) `verify_and_score`'s structural check (node 3) is exactly the
product's existing defense against this failure class — an invented
citation fails the "does this section exist" check and the finding renders
unverified/amber, not a silently-trusted bad answer. This is a reason the
current 4-node shape is adequate as-is, not a reason to add a node.

**Not fixed now.** Pinning `temperature=0` (or a seed, where the API
supports one) is a future option, tracked here rather than acted on,
because it trades away response diversity/quality for determinism the
product doesn't yet need — the verifier already catches the failure mode
this would prevent. Revisit if variance becomes a practical problem, e.g.
once grounding scores need to be stable run-to-run for the same input, not
just individually correct.

## Budget (original estimate, pre-2.5e)

| | Estimate | Basis |
|---|---|---|
| Latency p50 | ≤ 20s | Retrieval ~200–300ms (ADR 003/004, unchanged); `draft_opinion`'s single Sonnet call dominates — calibrated off ADR 001/007's single-question generation time (~7.1–7.4s for ≤400 output tokens), scaled up for a materially larger structured output (est. 600–1,200 tokens) and larger input (more passages) → est. 12–18s for that call alone; verify + DB writes are sub-second |
| Latency p95 | ≤ 30s | Same basis, wider tail per ADR 007's observed p50→p95 spread pattern (~1.4–1.6x) |
| Hard timeout | 60s | Background job, not blocking a render — generous relative to the p95 estimate |
| Cost | ≤ $0.05/opinion | ADR 001's single-query estimate (~$0.012) scaled for larger input (~3,000–5,500 tokens vs. ~2,700) and output (~600–1,200 tokens vs. ~150–400) at `claude-sonnet-4-6` pricing → est. $0.018–0.035; $0.05 leaves real headroom rather than ADR 001's tight $0.03 |

## Real measurement (Block 2.5e)

10-claim golden set (`apps/ai/eval/golden-coverage.json`) across all three
benchmark forms (F-122/F-123/F-144, MC0 chunking — ADR 007's shipped
config), covering `covered`/`excluded`/`partial`/`unclear` verdicts, run
twice independently (`apps/ai/eval/run_coverage_eval.py`, calling
`run_coverage_agent()` directly — the same function the background task
calls) against real retrieval and real Anthropic calls. Full row data and
per-node table in `apps/ai/eval/coverage-eval-results.md`.

| | Measured | vs. estimate |
|---|---|---|
| Latency p50 | 20,118ms | ≤ 20,000ms estimate — 0.6% over, inside n=10 noise |
| Latency p95 | 27,785ms | ≤ 30,000ms estimate — comfortably under |
| Cost/opinion | ~$0.023 mean ($0.016–$0.031 range) | ≤ $0.05 estimate — 46% of budget, real headroom |

**Per-node latency (seconds, from the Block 2.5d Langfuse spans — this is
the number ADR 007-style budget corrections need, and it wasn't available
until this block):**

| node | p50 | p95 | share of p50 |
|---|---|---|---|
| `retrieve` | 0.52s | 1.73s | 2.6% |
| `draft_opinion` (`claude_answer` generation) | 15.31s | 25.25s | 76.1% |
| `verify_and_score` | 1.50s | 4.71s | 7.5% |
| `write_review_queue` | 0.16s | 0.22s | 0.8% |

`draft_opinion`'s single Sonnet call is, as predicted, almost the entire
budget — three-quarters of p50, over 90% of p95. Retrieval, verification,
and the DB writes are collectively under 2.2s at p50. This matches the
original estimate's structure (retrieval sub-second, generation dominant)
closely enough that the estimate's *shape* was right; only the exact number
needed confirming.

Cost: Langfuse's `observations.get_many()` (the v2 list endpoint used for
the latency pull) doesn't return usage/cost fields, and this SDK version has
no per-observation detail fetch — so the cost figure above is the same
char/4 estimate method ADR 001 used, but grounded in this run's real data:
input side from one actual `retrieve_hybrid()` call's real retrieved
passages (not a guessed passage count), output side from every opinion's
real serialized JSON size. Embedding cost (1 query embedding + 1 per
verified finding) isn't included — negligible per ADR 001's existing
reasoning, unchanged here.

## Decision

**Accepted, budget confirmed as originally estimated — no knob correction.**
p50 at 20.1s against a 20.0s estimate is not a real overshoot: with n=10,
the median is inherently noisy (one claim landing a second either side
changes which value is "p50"), and it's nowhere near ADR 007's actual
budget bust (topK=10 measured 8,019ms against an 8,000ms *hard* p50 budget
on a synchronous, page-blocking path — a real, unambiguous overshoot this
isn't). p95 (27.8s) and cost ($0.023 mean) both have real headroom against
their budgets (30s, $0.05).

Per the user's framing going in — correct the budget with justification, or
tune a knob, if p50 busts the estimate — the justified call here is
**neither**: the estimate wasn't wrong enough to need correcting, and there
is no knob to tune that wouldn't trade away something already spoken for.
`draft_opinion` dominating at 76% of p50 is structural (a multi-finding
cited legal opinion requires more generation than a one-line Q&A answer),
not a misconfiguration — cutting `COVERAGE_MAX_TOKENS` risks truncating
findings, and cutting `COVERAGE_RETRIEVE_TOP_K`/`POOL` would save at most
~1s at `retrieve` (2.6% of p50) while directly working against the
retrieval-coverage finding below, which points the opposite direction.

## Separate finding: a reproducible retrieval-coverage gap (not a latency issue)

3/10 claims scored FAIL across **both** independent 2.5e runs, with the
**same** claims failing the **same** way each time (not generation noise —
contrast the isolated, non-reproducible SEVERE from Block 2.5a's
verification). Two of the three are the concerning kind: the agent's
opinion never engages with the actual controlling clause at all, and
instead builds plausible-sounding alternative reasoning from real (not
hallucinated — every citation passed `verified=true`) but wrong-for-this-
question chunks:

- **Claim 2** (a riding mower destroyed by floodwater in an attached
  garage; expected `excluded` under `IV.5`, self-propelled vehicles) — the
  opinion never cites or mentions `IV.5` at all. It reasons instead from
  personal-property coverage (`III.B.1`) and attached-vs-detached garage
  sublimits (`III.A.2`/`III.A.3`), reaching `partial` — a real miss in the
  harmful direction (implying some coverage exists for property the policy
  excludes outright).
- **Claim 3** (finished-basement flood damage — drywall, a built-in wet
  bar, carpet; expected `partial` under `III.A.8`/`III.A.8.a`'s basement
  item limitation) — the opinion never cites `III.A.8`. It instead
  constructs coverage for the wet bar via `III.A.7.c` (built-in
  dishwashers — not a wet bar) and for the carpet via a differently-worded
  carpet clause, reaching a more generous `partial` than the actual
  controlling limitation supports.

Working hypothesis: `COVERAGE_RETRIEVE_TOP_K=12` — a first guess per this
ADR's own original estimate, never benchmarked — doesn't reliably surface
the controlling clause for claim-*narrative* queries the way it does for
the golden Q&A set's narrower, more targeted questions (ADR 003/004's
corpus). `retrieve`'s own latency (0.52s p50) means there's real room to
raise `COVERAGE_RETRIEVE_TOP_K`/`POOL` without a meaningful latency cost —
but that's an accuracy decision requiring its own measurement (does a
higher topK actually fix these two cases without adding noise, the same
question ADR 004 asked and answered for the QA path), not something to
change inside this latency-focused ADR on the strength of 2 data points.
**Not fixed now** — recorded as the clearest lead for whichever block picks
up coverage-agent accuracy next.

## What would change this

- **2.5e's real measurement** — done; this ADR's Status now reflects it.
- **The retrieval-coverage finding above, if it recurs on a larger claim
  set** — the clearest next step is re-running the golden set (or a larger
  one) at `COVERAGE_RETRIEVE_TOP_K=16-20` to see whether claims 2 and 3
  resolve without new noise, the same ablation shape ADR 004 already ran
  once for the QA path.
- If `draft_opinion`'s structured output size drifts materially from this
  run's observed 548-1,537 output tokens (e.g. once real users submit
  longer, messier claim descriptions than this golden set's clean
  single-issue claims), both latency and cost move proportionally — revisit
  then, not preemptively.
- If the coverage agent's retrieval step surfaces a systematic single-
  retriever weak spot (dense vs. hybrid, not just topK depth), that's new
  router evidence per ADR 008's "what would change this" — not yet observed
  here; the 2.5e misses trace to retrieval *depth*, not retriever *choice*.

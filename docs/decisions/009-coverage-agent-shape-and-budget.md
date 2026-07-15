# ADR 009 — Coverage agent: 4-node LangGraph, background-job budget

**Status:** Proposed. Sets the target Block 2.5 is built and measured
against, same posture as ADR 001 for the retrieval ablation — an estimate to
be replaced with real numbers once 2.5e's golden eval runs, not a number the
build is gated on in advance. Expect a post-build correction in the same
shape as ADR 007's topK 10→8 (ship the estimate, measure for real, adjust
the knob that's actually over budget).

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

## Budget (estimate — see Status)

| | Estimate | Basis |
|---|---|---|
| Latency p50 | ≤ 20s | Retrieval ~200–300ms (ADR 003/004, unchanged); `draft_opinion`'s single Sonnet call dominates — calibrated off ADR 001/007's single-question generation time (~7.1–7.4s for ≤400 output tokens), scaled up for a materially larger structured output (est. 600–1,200 tokens) and larger input (more passages) → est. 12–18s for that call alone; verify + DB writes are sub-second |
| Latency p95 | ≤ 30s | Same basis, wider tail per ADR 007's observed p50→p95 spread pattern (~1.4–1.6x) |
| Hard timeout | 60s | Background job, not blocking a render — generous relative to the p95 estimate |
| Cost | ≤ $0.05/opinion | ADR 001's single-query estimate (~$0.012) scaled for larger input (~3,000–5,500 tokens vs. ~2,700) and output (~600–1,200 tokens vs. ~150–400) at `claude-sonnet-4-6` pricing → est. $0.018–0.035; $0.05 leaves real headroom rather than ADR 001's tight $0.03 |

## Decision

**Proposed.** Build the 4-node graph as a background job against these
budgets. Per the user's note approving this plan: **2.5e's real measurement
is the moment of truth**, not this estimate — if real latency or cost blows
through the budget the way `MATTER_QA_TOP_K=10` did in ADR 007, the fix is
the same shape (tune the knob that's actually over — likely `topK`/`pool`
on the `retrieve` node, or `ANTHROPIC_MAX_TOKENS` on `draft_opinion` — not a
redesign of the graph).

## What would change this

- **2.5e's real measurement** (the whole point of "Proposed" status) —
  replace every estimate above with real Langfuse/harness numbers, exactly
  as ADR 007 replaced ADR 004's local-proxy estimate with real Render
  numbers and corrected `topK` 10→8.
- If `draft_opinion`'s structured output is materially smaller or larger
  than the 600–1,200 token estimate once real opinions are drafted, both the
  latency and cost estimates move proportionally — this is the single
  biggest source of estimate error here, same as ADR 001 flagged for the
  original single-question cost estimate.
- If the coverage agent's retrieval step (broader claim-language queries,
  not narrow golden questions) surfaces a systematic single-retriever weak
  spot, that's new router evidence per ADR 008's "what would change this."

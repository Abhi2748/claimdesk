# ADR 011 — Minimal input-side guardrails and structured errors

**Status:** Accepted. Adds the smallest layer that addresses the real
threat model (indirect injection via uploaded PDFs) plus input validation
and failure visibility — without a guardrails framework, output rewriting,
or schema migrations.

## Question

What hardening should ClaimDesk ship now that Phase 2's AI surfaces
(matter Q&A, coverage agent) are live, given that (a) users upload
arbitrary PDFs that become retrieved passages, (b) the product already
has several output-side trust controls, and (c) the Phase 2 brief's
discipline is "simplest option that clears the bar"?

## Existing controls (out of this ADR's scope — already shipping)

These already act as rails; this ADR does **not** rebuild them:

1. **Citation verifier** — section/page markers must resolve to a
   retrieved passage (green verified / amber unverified). Acts as a
   groundedness rail on free-text Q&A answers.
2. **Coverage `verify_and_score`** — structural verification + embedding
   grounding scores before anything hits the review queue.
3. **Hard refusal contract** — exact string
   `I can't find this in the policy.` on insufficient evidence.
4. **Demo read-only** — demo org cannot write opinions / mutate data.
5. **Org-scoped RLS + RBAC + MFA + audit trail** — tenancy and access.
6. **Human review queue** — coverage opinions (and flagged answers) are
   never auto-approved.

**Scope of this ADR: input-side + error handling only.**

## Decision — what we add

| Control | Where | Why it's enough |
|---|---|---|
| Passage DATA delimiters + system-prompt rules | `apps/ai` prompt construction (`<<<POLICY_PASSAGE>>>` … `<<<END_POLICY_PASSAGE>>>`) | Direct answer to indirect injection: model is told passage content is DATA, never instructions |
| Pattern scan over retrieved chunk text | `app/services/injection.py`; flags returned on QA responses and appended to coverage review summaries | Surfaces attempts without silently dropping evidence counsel may need |
| Length + control-char sanitization | Pydantic validators on `question` / `claim_summary` | Cheap rejection of absurd inputs before spend |
| Structured error bodies | FastAPI exception handlers (`app/errors.py`); web `friendlyAiError` | No stack traces to clients; short user-safe messages |
| Anthropic client timeout (60s) | `anthropic.Anthropic(timeout=…)` | Fail closed instead of hanging a worker |
| Coverage failure → `review_items` row | `record_coverage_failure` after background exception | A failed 202 job is visible in `/review`, not silent |

## Decision — what we skip (and why)

| Skipped | Why not now |
|---|---|
| NeMo Guardrails / LlamaGuard / Prompt Guard / similar frameworks | Heavy dependency + latency/cost with no measured failure on our corpus yet; delimiters + pattern flag clear the immediate bar |
| LLM-as-judge injection classifier | Doubles Sonnet cost on every retrieve for an unbenchmarked gain; revisit if pattern scan false-negatives show up in review |
| Silently dropping flagged passages | Hides potential controlling text from counsel; flag + retain is the legal-product choice |
| Output rewriting / answer scrubbers | Citation verifier + review queue already catch fabrications; a second rewrite path risks mutating correct cites |
| New DB job-status enum / migration | Existing `review_items` pending row is enough to surface failures without schema churn |
| Changing the frozen F-122 web `lib/qa` path | Eval gate stays on the control path; this ship lives in `apps/ai` (+ thin web error UX) |
| Coverage graph hard-timeout beyond Anthropic 60s | Anthropic timeout covers the slow node; a full-graph deadline needs evidence of hang modes we haven't seen |

## Scorecard

| Axis | Judgment |
|---|---|
| Quality / safety | Closes the PDF-as-instruction path with explicit DATA framing; flags known phrasings |
| Latency | Pattern scan is microseconds; delimiters add negligible tokens |
| Cost | No new model calls |
| Complexity | ~few small modules; no new infra |
| Operational burden | Failure rows appear in review queue operators already use |
| Reversibility | Delimiters / validators / handlers are easy to revert; flags are additive on responses |

## What would change this

- Measured false-negatives on real uploaded policies → widen patterns or add a cheap classifier behind a feature flag
- Hang modes that outlive the Anthropic timeout → graph-level deadline
- Volume of silent queue misses despite `record_coverage_failure` → dedicated job table
- Need for the same delimiter protocol on the **web** frozen F-122 path → only after eval re-gates it (17/20, 0 SEVERE)

## Verification

- `apps/ai` pytest (includes fixture chunk with injection attempt)
- `ruff check`
- `pnpm --filter web` typecheck + lint
- `pnpm --filter web eval` must remain **≥ 17/20 PASS, 0 SEVERE** (frozen path untouched)

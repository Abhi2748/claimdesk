# ADR 011 — Minimal input-side guardrails and structured errors

**Status:** Accepted. Guardrails ON on live `/qa/matter` and coverage
despite a measured −2 PASS on the 43-question matter corpus (41/43 →
39/43, **0 SEVERE either way**). Coverage stayed 8/10. Tradeoff rationale
below.

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
| Passage DATA delimiters + system-prompt rules | Live matter + coverage only (`<<<POLICY_PASSAGE>>>` … `<<<END_POLICY_PASSAGE>>>`); **not** frozen `/qa/answer` | Direct answer to indirect injection: model is told passage content is DATA, never instructions |
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
| Changing the frozen F-122 `/qa/answer` path | Eval gate stays on the control path; delimiters live on matter + coverage only |
| Coverage graph hard-timeout beyond Anthropic 60s | Anthropic timeout covers the slow node; a full-graph deadline needs evidence of hang modes we haven't seen |

## Scorecard

| Axis | Judgment |
|---|---|
| Quality / safety | Closes the PDF-as-instruction path with explicit DATA framing; flags known phrasings. Accepted −2 PASS on matter (citation misses only, 0 SEVERE) |
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
- Recovering the two `II.B` citation misses via delimiter/prompt refinement → re-run live-matter; adopt if back to ≥41/43 without losing the injection framing

## Correction (CI eval-gate) — and honesty about Q10

ADR 011 initially applied DATA delimiters to `generate_policy_answer_
from_passages`, which also serves frozen `/qa/answer` — the path CI
gates with `QA_TARGET=remote`. That silently changed the F-122 control
prompt. **Corrected:** delimiters + injection system rules apply only to
matter Q&A (`guarded=True` / `MATTER_QA_SYSTEM_PROMPT`) and coverage;
`/qa/answer` keeps the pre-011 passage format and system prompt.

**Q10 diagnosis was ambiguous and was not isolated.** CI failed at 16/20
with an extra FAIL on golden Q10 (must cite `VI.C`) on top of the known
baseline fails (4 / 13 / 18). Q10 is a known flake even on the untouched
local F-122 path (observed 16/20 with Q10 FAIL in the same session before
any remote prompt change). We did **not** A/B the delimited vs undelimited
`/qa/answer` prompt on Q10 alone, so we cannot claim the delimiters caused
the CI miss. The `/qa/answer` revert was on **principle** (frozen control
stays frozen per CLAUDE.md / ADR 007 discipline), not on a proven causal
link from delimiters → Q10 FAIL.

## Benchmark after scoping delimiters to matter + coverage

Measured with guardrails ON (local `apps/ai` serving guarded matter +
coverage prompts). Snapshots:
`apps/web/eval/live-matter-results-guarded-adr011.md`,
`apps/ai/eval/coverage-eval-results-guarded-adr011.md`.

| Harness | Baseline | Guarded run | Verdict |
|---|---|---|---|
| Live `/qa/matter` 43Q (ADR 007) | **41/43**, 0 SEVERE | **39/43**, 0 SEVERE | −2 PASS, 0 SEVERE |
| Coverage golden 10-claim (ADR 009/010) | **8/10**, 0 SEVERE | **8/10**, 0 SEVERE | No change |

### Accepted tradeoff

**Guardrails stay ON.** 39/43 guarded vs 41/43 unguarded, **0 SEVERE
either way.** Rationale:

1. The regression is **missing citations** (scorer expects `II.B`; the
   answer may still be substantively right but fails the exact-label
   gate) — that degrades into amber/unverified citation UX, not into
   hallucinations or SEVERE invented cites.
2. Opposing-party documents (denial letters, insurer correspondence) are
   an **adversarial input source** in this domain; indirect
   prompt-injection defense is warranted even at a small exact-cite cost.

### Known issue (precise)

Both new FAILs vs the shipped topK=8 baseline
(`live-matter-results-render-topk8.md`) are the **same systematic miss**:

- F-122-ABLATION-MC0 Q1 — FAIL, missing required cite `II.B`
- F-144-MC0 Q2 — FAIL, missing required cite `II.B`

Flood-definition questions across **two different forms**, both missing
`II.B` under delimiter framing. Not general degradation — a narrow,
repeatable effect of the DATA-delimiter / system-prompt wording. Likely
recoverable with delimiter or prompt refinement; that is the next step if
this issue is revisited. Baseline FAILs (F-122 Q4, F-122 Q18) and coverage
fails (claim 1 / claim 2 `IV.5`) were unchanged.

### CI gap

The path-filtered eval gate only covers frozen `/qa/answer` (no end users;
CI `QA_TARGET=remote`). Live `/qa/matter` and the coverage agent are
benchmarked manually (`eval/live-matter-eval.ts`,
`apps/ai/eval/run_coverage_eval.py`) but **not gated in CI**. That is why
this −2 PASS regression required a hand-run to find. Closing that gap
(optional follow-up) would mean a CI job that hits `/qa/matter` (or a
local proxy of it) on `apps/ai` prompt changes — separately from the
frozen F-122 control.

## Verification

- `apps/ai` pytest (includes fixture chunk with injection attempt)
- `ruff check`
- `pnpm --filter web` typecheck + lint
- Frozen F-122 gate (local or `QA_TARGET=remote` against `/qa/answer`)
  must stay **≥ 17/20 PASS, 0 SEVERE**
- Live-matter + coverage benchmarks: table above; matter tradeoff accepted

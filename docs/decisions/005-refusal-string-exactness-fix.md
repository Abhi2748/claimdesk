# ADR 005 — Refusal-string exactness: post-check normalization over prompt tightening

**Status:** Accepted — a deterministic post-check (`normalizeRefusalAnswer`)
ships in both production paths and the retrieval-lab harness. The system
prompt is **unchanged**; a prompt-tightening attempt was tried first, broke
the frozen F-122 gate, and was reverted before commit.

## Question

ADR 004 flagged the corpus's last 2 SEVEREs (`F-123 Q13`, `F-144 Q10`) as
pure refusal-string-exactness failures, not retrieval: the model correctly
identifies these as should-refuse questions (liability/bodily-injury traps
outside this policy's property-only scope) and opens its answer with the
exact `REFUSAL_MESSAGE`, but then appends unsolicited explanatory prose,
breaking the scoring harness's exact-match check. Scope: diagnose the
deviation, propose the minimal fix (prompt wording vs. a post-check), and
confirm the frozen F-122 gate (17/20, 0 SEVERE) still holds afterward.

## Method

A one-off diagnostic script (`apps/web/scripts/diag-refusal.ts`, deleted
after use) reproduced both SEVERE cases directly against the hybrid +
MC0 + topK10 config (ADR 004's best cell) and printed the raw model output.

Raw output — both cases, identical pattern:

```
I can't find this in the policy.

The provided policy passages address property damage coverage, pollution
damage, increased cost of compliance, and related flood insurance
provisions. None of the passages contain any language addressing
third-party bodily injury liability coverage...
```

The model gets the refusal decision right, then violates system-prompt rule
4 ("reply with exactly: I can't find this in the policy.") by treating it
as an opening line rather than the entire response — plausibly because the
"legal analyst for attorneys" framing plus rules 1–3 (cite everything, be
thorough) create pressure to justify the refusal instead of just stating it.

### Attempt 1 — prompt tightening (rejected)

Rewrote rule 4 from "reply with exactly: ..." to an emphatic "your ENTIRE
response must be exactly this sentence and nothing else — no explanation,
no caveats, no reasoning about what the passages do or don't cover: ...".

Fixed both target cases (verified via the diagnostic script). But re-running
the frozen F-122 gate immediately after: **PASS dropped from 17/20 to
14/20** — 3 previously-passing direct-hit questions (Q1, Q10, Q14; e.g. Q1
"How does this policy define a flood?" against a `top_sim=0.736` exact-match
chunk) started returning a bare refusal instead of a cited answer. The
stronger negative framing didn't just suppress trailing explanation — it
measurably shifted the model's underlying refuse/answer decision boundary:
removing its only outlet for hedging made it treat ordinary partial
uncertainty as grounds for a hard refusal rather than a caveated-but-cited
answer. **Reverted immediately per the "never regress below 17/20"
invariant; did not commit.**

### Attempt 2 — deterministic post-check (adopted)

Added `normalizeRefusalAnswer()` (`apps/web/lib/qa/constants.ts`, mirrored
in `apps/ai/app/constants.py` as `normalize_refusal_answer`): if the trimmed
model output starts with the exact `REFUSAL_MESSAGE` and has anything else
after it, collapse the return value to just the canonical string.

```ts
export function normalizeRefusalAnswer(rawAnswer: string): string {
  const trimmed = rawAnswer.trim();
  if (trimmed !== REFUSAL_MESSAGE && trimmed.startsWith(REFUSAL_MESSAGE)) {
    return REFUSAL_MESSAGE;
  }
  return trimmed;
}
```

This never touches the system prompt, so the refuse/answer decision
boundary is untouched — it only cleans up formatting *after* the model has
already decided to refuse. Wired into the one production call site
(`generatePolicyAnswerFromPassages` in `lib/anthropic.ts`), its Python
mirror (`generate_policy_answer_from_passages` in
`apps/ai/app/services/anthropic.py`), and the retrieval-lab harness's
measured-generation path (`eval/retrieval-lab.ts`), so ablation runs reflect
the same behavior production gets.

## Result

| | Before | Attempt 1 (prompt) | Attempt 2 (post-check) |
|---|---|---|---|
| F-123 Q13 / F-144 Q10 | SEVERE | PASS | PASS |
| Frozen F-122 gate | 17/20, 0 SEVERE | **14/20, 0 SEVERE (regression)** | 17/20, 0 SEVERE (unchanged, same 3 FAIL ids: Q4, Q13, Q18) |
| Full corpus sweep (ADR 004's D config) | 39/43, 2 SEVERE | not re-run (reverted before re-sweeping) | **41/43, 0 SEVERE** |

Full post-fix sweep: `eval/sweep-d-mc0-topk10-refusalfix.md`. The 2
remaining FAILs (`F-122-ABLATION-MC0` Q4, Q18) are the pre-existing
"missing required cite" cases already tracked in ADR 004 — unrelated to
refusal, unaffected by this change. **Zero SEVEREs remain anywhere in the
43-question ablation corpus or the 20-question frozen F-122 corpus.**

## Why the post-check is also a real correctness fix, not eval-gaming

The production pipeline's citation-attachment logic keys off exact string
equality: `const refused = answer === REFUSAL_MESSAGE;`
(`lib/qa/pipeline.ts`). Before this fix, any time the model padded a
refusal with explanation, that check silently failed in *production* too —
the response would carry irrelevant citations alongside what was
functionally a refusal, on a should-refuse question. The post-check fixes
the same underlying bug the eval caught; the eval score moving is a
side effect of fixing real behavior, not the target.

## Scorecard (§5A factors)

| Factor | Reading |
|---|---|
| Quality | Clears both remaining SEVEREs corpus-wide (43-question sweep: 2→0); frozen gate unchanged (17/20, 0 SEVERE) |
| Latency/cost | None — no new model call, pure post-processing on text already returned |
| Complexity | ~10-line pure function, one call site added in each of 3 runtimes (TS prod path, Python prod path, TS eval harness) |
| Operational burden | None — no new vendor, no new config |
| Reversibility | Trivial — delete the wrapper call, revert to plain `.trim()` |

## Decision

**Accepted.** `normalizeRefusalAnswer()` / `normalize_refusal_answer()` ship
in both the TS and Python production paths and the retrieval-lab harness.
System prompt wording is **unchanged** from before this ADR. Attempt 1 is
recorded here specifically as a rejected approach: "make the instruction
more emphatic" is the obvious first move on a prompt-adherence bug, and
re-attempting it (or a half-strength variant) later without this record
would risk re-spending an eval cycle rediscovering the same regression.

## What would change this

- This post-check only catches the observed failure shape: exact
  `REFUSAL_MESSAGE` prefix followed by trailing text. A future case where
  the model paraphrases the refusal itself (not just appends explanation),
  or explains first and refuses last, would slip through and need a
  semantic/fuzzy check instead of a literal prefix match. Not observed in
  the 63 questions run across both corpora during this fix.
- If prompt-level control becomes necessary for another reason, a milder
  variant of Attempt 1 (e.g. permitting one short justification clause
  instead of forbidding all trailing text) might avoid the over-triggering
  seen here — untested, since the post-check made it unnecessary to find
  out.

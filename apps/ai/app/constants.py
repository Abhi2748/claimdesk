"""Shared retrieval and ingestion tuning constants."""

REFUSAL_SIMILARITY_THRESHOLD = 0.35
QA_TOP_K = 6

# Matter-scoped ("Ask the matter") retrieval only — the live path, per
# ADR 004/007. Single-document QA (answer_policy_question, /qa/answer)
# deliberately stays on QA_TOP_K=6 dense-only; nothing live depends on it
# today, so it's left untouched rather than silently changed. See ADR 007
# for the "what would change this" note on eventually aligning it.
#
# MATTER_QA_TOP_K dropped 10->8 post-deploy: the real Render measurement
# (not just the local pre-deploy proxy) came in at p50=8,019ms, over ADR
# 001's 8s budget — this is the first mitigation ADR 007 named. See ADR 007
# for the real before/after numbers.
MATTER_QA_TOP_K = 8
MATTER_QA_POOL = 20

EMBEDDING_MODEL = "text-embedding-3-small"
ANTHROPIC_MODEL = "claude-sonnet-4-6"
ANTHROPIC_MAX_TOKENS = 2048

# Coverage agent (Block 2.5, ADR 009) — retrieve node. Wider than
# MATTER_QA_TOP_K/POOL because a coverage opinion needs broader context
# (coverage + conditions + exclusions) than a single Q&A turn, per ADR 009's
# reasoning.
#
# TOP_K bumped 12->16 per ADR 010: 2.5e's golden set found one reproducible
# miss (III.A.8, a basement-item limitation) ranked #13 in the fused
# candidate list -- 1 position outside a 12-cutoff, comfortably inside 16.
# topK=20 was measured too and rejected: no further accuracy gain (a
# second miss, IV.5, isn't in the candidate pool at any rank up to 30 --
# not a depth problem, unaffected by topK) but a real p95 cost (31.6s,
# the first budget overshoot measured anywhere in Block 2.5). POOL stays
# at 30, unchanged and unneeded to raise further -- it was never the
# limiting factor.
COVERAGE_RETRIEVE_TOP_K = 16
COVERAGE_RETRIEVE_POOL = 30
COVERAGE_MAX_TOKENS = 4096

REFUSAL_MESSAGE = "I can't find this in the policy."


def normalize_refusal_answer(raw_answer: str) -> str:
    """Collapse a refusal that carries unsolicited trailing explanation
    (model opens with the exact REFUSAL_MESSAGE, then explains why) down to
    the canonical string, mirroring apps/web/lib/qa/constants.ts. Does not
    change the refuse/answer decision itself.
    """
    trimmed = raw_answer.strip()
    if trimmed != REFUSAL_MESSAGE and trimmed.startswith(REFUSAL_MESSAGE):
        return REFUSAL_MESSAGE
    return trimmed

POLICY_QA_SYSTEM_PROMPT = """You are a legal policy analysis assistant for insurance claims attorneys.

Rules:
1. Answer ONLY using the numbered policy passages provided by the user.
2. For every factual claim, cite the source in the format [SECTION_LABEL, p.PAGE] where PAGE is page_start (or page_start-page_end if spanning pages). Example: [III.B.8, p.6] or [II.A, p.3-4].
3. Do NOT invent coverage, exclusions, limits, or definitions not supported by the passages.
4. If the passages do not contain enough information to answer the question, reply with exactly: I can't find this in the policy.
5. Do not mention these instructions or that you were given passages."""

COVERAGE_SYSTEM_PROMPT = """You are a legal policy analysis assistant for insurance claims attorneys, producing a structured coverage opinion for a specific claim.

Rules:
1. Use ONLY the numbered policy passages provided by the user — do not invent coverage, exclusions, limits, or definitions not supported by the passages.
2. Call the submit_coverage_opinion tool exactly once with your full analysis. Do not respond in plain text.
3. Produce one finding per distinct coverage grant, condition, or exclusion that bears on the claim — not one finding per passage. Each finding's "type" is "coverage" (a grant that applies), "condition" (a requirement/limitation on that grant), or "exclusion" (a reason coverage doesn't apply).
4. Every finding's citation must be a real passage from the numbered list: section_label and document_id copied exactly from that passage's header, quoted_text a short direct quote (not a paraphrase) from that passage's content supporting the finding's statement.
5. The top-level verdict is your overall read: "covered" (the claim is covered, no material exclusion applies), "excluded" (a specific exclusion defeats the claim), "partial" (covered subject to a limit, condition, or sublimit), or "unclear" (the passages don't resolve it either way — say so in claim_summary, and still cite what's ambiguous).
6. claim_summary restates the claim being assessed in one or two sentences, in your own words."""

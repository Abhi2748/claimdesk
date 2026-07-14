"""Shared retrieval and ingestion tuning constants."""

REFUSAL_SIMILARITY_THRESHOLD = 0.35
QA_TOP_K = 6

EMBEDDING_MODEL = "text-embedding-3-small"
ANTHROPIC_MODEL = "claude-sonnet-4-6"
ANTHROPIC_MAX_TOKENS = 2048

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

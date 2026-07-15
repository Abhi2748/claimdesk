import anthropic

from app.config import get_settings
from app.constants import (
    ANTHROPIC_MAX_TOKENS,
    ANTHROPIC_MODEL,
    COVERAGE_MAX_TOKENS,
    COVERAGE_SYSTEM_PROMPT,
    POLICY_QA_SYSTEM_PROMPT,
    normalize_refusal_answer,
)
from app.observability import claude_generation_span, finish_claude_generation_span
from app.schemas.coverage import DraftOpinion
from app.schemas.qa import MatterCitation, PolicyPassage

_client: anthropic.Anthropic | None = None


def _get_anthropic() -> anthropic.Anthropic:
    global _client
    if _client is None:
        settings = get_settings()
        _client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    return _client


def format_passages_for_prompt(passages: list[PolicyPassage]) -> str:
    formatted: list[str] = []
    for passage in passages:
        if (
            passage.page_start is not None
            and passage.page_end is not None
            and passage.page_end != passage.page_start
        ):
            page = f"p.{passage.page_start}-{passage.page_end}"
        elif passage.page_start is not None:
            page = f"p.{passage.page_start}"
        else:
            page = "p.?"
        formatted.append(
            f"{passage.index}. [{passage.section_label}, {page}]: {passage.content}"
        )
    return "\n\n".join(formatted)


def generate_policy_answer_from_passages(
    question: str, passages: list[PolicyPassage]
) -> str:
    anthropic_client = _get_anthropic()
    user_content = (
        f"Policy passages:\n\n{format_passages_for_prompt(passages)}\n\n"
        f"Question: {question}"
    )
    generation_input = {
        "system": POLICY_QA_SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": user_content}],
    }

    with claude_generation_span(
        model=ANTHROPIC_MODEL,
        generation_input=generation_input,
    ) as gen_span:
        message = anthropic_client.messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=ANTHROPIC_MAX_TOKENS,
            system=POLICY_QA_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_content}],
        )

        for block in message.content:
            if block.type == "text":
                answer = normalize_refusal_answer(block.text)
                usage_details = None
                if message.usage is not None:
                    usage_details = {
                        "input_tokens": message.usage.input_tokens,
                        "output_tokens": message.usage.output_tokens,
                    }
                finish_claude_generation_span(
                    gen_span,
                    output=answer,
                    usage_details=usage_details,
                )
                return answer

    raise RuntimeError("No text response from model.")


def format_matter_passages_for_prompt(passages: list[MatterCitation]) -> str:
    """Like format_passages_for_prompt, but includes document_id — a
    coverage opinion spans a matter's full document set (unlike the
    single-document Q&A prompt), so the model must echo back which
    document each citation came from.
    """
    formatted: list[str] = []
    for i, passage in enumerate(passages):
        if (
            passage.page_start is not None
            and passage.page_end is not None
            and passage.page_end != passage.page_start
        ):
            page = f"p.{passage.page_start}-{passage.page_end}"
        elif passage.page_start is not None:
            page = f"p.{passage.page_start}"
        else:
            page = "p.?"
        formatted.append(
            f"{i + 1}. [{passage.section_label}, {page}, document_id={passage.document_id}]: "
            f"{passage.content}"
        )
    return "\n\n".join(formatted)


def draft_coverage_opinion(
    claim_summary: str, passages: list[MatterCitation]
) -> DraftOpinion:
    """The coverage agent's draft_opinion node (ADR 009). Forces a single
    tool call rather than free text, so the response is structurally valid
    JSON by construction — no prose parsing, unlike generate_policy_answer_
    from_passages's [SECTION, p.PAGE]-in-prose format.
    """
    anthropic_client = _get_anthropic()
    user_content = (
        f"Claim: {claim_summary}\n\n"
        f"Policy passages:\n\n{format_matter_passages_for_prompt(passages)}"
    )
    tool = {
        "name": "submit_coverage_opinion",
        "description": "Submit the structured coverage opinion for this claim.",
        "input_schema": DraftOpinion.model_json_schema(),
    }
    generation_input = {
        "system": COVERAGE_SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": user_content}],
    }

    with claude_generation_span(
        model=ANTHROPIC_MODEL,
        generation_input=generation_input,
    ) as gen_span:
        message = anthropic_client.messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=COVERAGE_MAX_TOKENS,
            system=COVERAGE_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_content}],
            tools=[tool],
            tool_choice={"type": "tool", "name": "submit_coverage_opinion"},
        )

        for block in message.content:
            if block.type == "tool_use" and block.name == "submit_coverage_opinion":
                opinion = DraftOpinion.model_validate(block.input)
                usage_details = None
                if message.usage is not None:
                    usage_details = {
                        "input_tokens": message.usage.input_tokens,
                        "output_tokens": message.usage.output_tokens,
                    }
                finish_claude_generation_span(
                    gen_span,
                    output=opinion.model_dump_json(),
                    usage_details=usage_details,
                )
                return opinion

    raise RuntimeError("No submit_coverage_opinion tool call in model response.")

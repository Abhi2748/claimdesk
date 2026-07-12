import anthropic

from app.config import get_settings
from app.constants import (
    ANTHROPIC_MAX_TOKENS,
    ANTHROPIC_MODEL,
    POLICY_QA_SYSTEM_PROMPT,
)
from app.observability import claude_generation_span, finish_claude_generation_span
from app.schemas.qa import PolicyPassage

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
                answer = block.text.strip()
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

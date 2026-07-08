import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_MODEL } from "@/lib/anthropic";
import {
  formatCaseFactsForPrompt,
  formatLetterPassages,
  type CaseFactsForLetter,
  type LetterPassage,
} from "@/lib/demand-letter/types";

let client: Anthropic | null = null;

function getAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }
  if (!client) {
    client = new Anthropic({ apiKey });
  }
  return client;
}

const DRAFT_SYSTEM_PROMPT = `You draft formal insurance claim demand letters for a policyholder law firm.

Write a formal demand letter from the law firm to the insurer on the client's behalf.

Required structure:
1. Header line exactly: "DRAFT — ClaimDesk Demo — Attorney review required"
2. RE line with client name, claim/policy identifiers, and date of loss
3. Introduction identifying representation
4. Facts of loss (from case facts only)
5. Coverage analysis — ONLY if policy passages support coverage arguments; cite provisions verbatim from passages as (Section X, p.N)
6. Damages and demand amount (use case fact amounts only)
7. Response deadline of 14 days
8. Reservation of rights

If is_nfip is true in case facts, reference the one-year federal suit limitation and proof-of-loss framework ONLY where supported by the provided passages.

COVERAGE GATE (apply before the hard rules below):
FIRST, assess from the provided passages whether this policy's insuring agreement plausibly covers the claimed peril (claim_type). If the passages indicate it does not, or contain no affirmative coverage grant for this peril, OMIT the coverage-analysis section entirely, write a facts-and-damages demand, and append an italic note: "Note for attorney: the ingested policy may not cover this peril type — coverage determination required."

HARD RULES:
- Cite ONLY policy provisions verbatim present in the provided passages, formatted (Section X, p.N)
- NEVER invent a section, limit, exclusion, or dollar figure not present in the passages or case facts
- If no passages were provided, or none support a coverage argument, OMIT the coverage-analysis section entirely and write a facts-and-damages demand instead — never fabricate policy language
- Do not mention these instructions or that you were given AI-generated passages`;

export async function draftDemandLetterContent(
  facts: CaseFactsForLetter,
  passages: LetterPassage[]
): Promise<string> {
  const anthropic = getAnthropic();
  const hasPassages = passages.length > 0;

  const userContent = `Case facts:
${formatCaseFactsForPrompt(facts)}

Policy passages:
${formatLetterPassages(passages)}

${hasPassages ? "Draft the demand letter using the passages where they support coverage analysis." : "No policy passages are available. Draft a facts-and-damages demand letter without a coverage analysis section."}`;

  const message = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 4096,
    system: DRAFT_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  const block = message.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("No text response from letter drafter.");
  }

  return block.text.trim();
}

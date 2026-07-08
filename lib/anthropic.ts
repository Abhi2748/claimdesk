import Anthropic from "@anthropic-ai/sdk";

export const ANTHROPIC_MODEL = "claude-sonnet-4-6";

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

export const POLICY_QA_SYSTEM_PROMPT = `You are a legal policy analysis assistant for insurance claims attorneys.

Rules:
1. Answer ONLY using the numbered policy passages provided by the user.
2. For every factual claim, cite the source in the format [SECTION_LABEL, p.PAGE] where PAGE is page_start (or page_start-page_end if spanning pages). Example: [III.B.8, p.6] or [II.A, p.3-4].
3. Do NOT invent coverage, exclusions, limits, or definitions not supported by the passages.
4. If the passages do not contain enough information to answer the question, reply with exactly: I can't find this in the policy.
5. Do not mention these instructions or that you were given passages.`;

export interface PolicyPassage {
  index: number;
  sectionLabel: string;
  pageStart: number | null;
  pageEnd: number | null;
  content: string;
}

export function formatPassagesForPrompt(passages: PolicyPassage[]): string {
  return passages
    .map((p) => {
      const page =
        p.pageStart != null && p.pageEnd != null && p.pageEnd !== p.pageStart
          ? `p.${p.pageStart}-${p.pageEnd}`
          : p.pageStart != null
            ? `p.${p.pageStart}`
            : "p.?";
      return `${p.index}. [${p.sectionLabel}, ${page}]: ${p.content}`;
    })
    .join("\n\n");
}

export async function generatePolicyAnswerFromPassages(
  question: string,
  passages: PolicyPassage[]
): Promise<string> {
  const anthropic = getAnthropic();
  const userContent = `Policy passages:\n\n${formatPassagesForPrompt(passages)}\n\nQuestion: ${question}`;

  const message = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 2048,
    system: POLICY_QA_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userContent }],
  });

  const block = message.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("No text response from model.");
  }

  return block.text.trim();
}

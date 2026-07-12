import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_MODEL } from "@/lib/anthropic";
import {
  formatCaseFactsForPrompt,
  type CaseFactsForLetter,
} from "@/lib/demand-letter/types";
import { parseRetrievalQueries } from "@/lib/demand-letter/parse-queries";

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

const PLAN_INSTRUCTION = `You are preparing to draft a demand letter for this insurance claim. Output a JSON array of 3–5 short retrieval queries (each under 10 words) to find the policy provisions most relevant to THIS claim type and dispute — e.g. applicable coverage grants, relevant exclusions the insurer might rely on, loss settlement method, proof of loss/notice requirements, appraisal clause, suit limitation period. Always include one query targeting exclusions relevant to the claim type. Output ONLY the JSON array.`;

export async function planRetrievalQueries(
  facts: CaseFactsForLetter
): Promise<string[]> {
  const anthropic = getAnthropic();
  const message = await anthropic.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `${PLAN_INSTRUCTION}\n\nCase facts:\n${formatCaseFactsForPrompt(facts)}`,
      },
    ],
  });

  const block = message.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("No text response from retrieval planner.");
  }

  return parseRetrievalQueries(block.text);
}

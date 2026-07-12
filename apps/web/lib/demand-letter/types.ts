export const DEMAND_LETTER_PROMPT_VERSION = "v1";

export interface CaseFactsForLetter {
  client_name: string;
  insurer: string | null;
  policy_number: string | null;
  state: string;
  claim_type: string;
  is_nfip: boolean;
  date_of_loss: string | null;
  amount_offered: number | null;
  amount_claimed: number | null;
}

export interface LetterPassage {
  sectionLabel: string;
  pageStart: number | null;
  pageEnd: number | null;
  content: string;
}

export function formatCaseFactsForPrompt(facts: CaseFactsForLetter): string {
  return JSON.stringify(
    {
      client: facts.client_name,
      insurer: facts.insurer,
      policy_number: facts.policy_number,
      state: facts.state,
      claim_type: facts.claim_type,
      is_nfip: facts.is_nfip,
      date_of_loss: facts.date_of_loss,
      amount_offered: facts.amount_offered,
      amount_claimed: facts.amount_claimed,
    },
    null,
    2
  );
}

export function formatLetterPassages(passages: LetterPassage[]): string {
  if (passages.length === 0) {
    return "(No policy passages retrieved.)";
  }
  return passages
    .map((p, i) => {
      const page =
        p.pageStart != null && p.pageEnd != null && p.pageEnd !== p.pageStart
          ? `p.${p.pageStart}-${p.pageEnd}`
          : p.pageStart != null
            ? `p.${p.pageStart}`
            : "p.?";
      const label = p.sectionLabel || "Section";
      return `[Passage ${i + 1}] (${label}, ${page}):\n${p.content}`;
    })
    .join("\n\n");
}

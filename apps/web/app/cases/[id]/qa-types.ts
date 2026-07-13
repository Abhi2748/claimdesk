export { REFUSAL_MESSAGE } from "@/lib/qa/constants";
export type { PolicyCitation } from "@/lib/qa/types";

export type AskPolicyResult =
  | {
      ok: true;
      answer: string;
      citations: import("@/lib/qa/types").PolicyCitation[];
      refused: boolean;
    }
  | { ok: false; error: string };

export type AskMatterResult =
  | { ok: true; answer: string; citations: import("@/lib/qa/types").PolicyCitation[];
      refused: boolean; sourceDocuments: { id: string; title: string }[];
      verification: import("@/lib/qa/types").VerificationResult | null }
  | { ok: false; error: string };

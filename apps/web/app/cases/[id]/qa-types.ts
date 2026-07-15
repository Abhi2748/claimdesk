export { REFUSAL_MESSAGE } from "@/lib/qa/constants";
export type { PolicyCitation } from "@/lib/qa/types";

export type AskMatterResult =
  | {
      ok: true;
      answer: string;
      citations: import("@/lib/qa/types").PolicyCitation[];
      refused: boolean;
      sourceDocuments: { id: string; title: string }[];
      verification: import("@/lib/qa/types").VerificationResult | null;
      injectionWarnings: string[];
    }
  | { ok: false; error: string };

export type RequestCoverageOpinionResult =
  | { ok: true; status: "accepted" }
  | { ok: false; error: string };

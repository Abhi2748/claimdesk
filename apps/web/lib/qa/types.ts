export interface PolicyCitation {
  id: number;
  sectionLabel: string;
  pageStart: number | null;
  pageEnd: number | null;
  content: string;
  similarity: number;
  documentId?: string;
  documentTitle?: string;
}

export interface NavStep {
  hop: number;
  consideredNodeIds: string[];
  pickedNodeIds: string[];
  reasoning: string;
}

export interface PolicyQAResult {
  answer: string;
  citations: PolicyCitation[];
  /** All chunks returned by match_chunks (even when similarity gate refuses). */
  retrievedChunks: PolicyCitation[];
  refused: boolean;
  topSimilarity: number | null;
  strategy?: "vector" | "tree";
  navigationPath?: NavStep[];
}

export interface MatterQAResult {
  answer: string;
  citations: PolicyCitation[];
  retrievedChunks: PolicyCitation[];
  refused: boolean;
  topSimilarity: number | null;
  sourceDocuments: { id: string; title: string }[];
  verification: VerificationResult | null;
}

export type CitationStatus = "verified" | "unverified";

export interface VerifiedCitation {
  marker: string;          // raw "[III.B.8, p.6]"
  label: string;           // parsed section label (uppercased)
  pages: number[];         // parsed page numbers ([] if none cited)
  status: CitationStatus;
  source?: PolicyCitation; // resolved retrieved passage (present iff verified)
}

export interface VerificationResult {
  citations: VerifiedCitation[];
  verifiedCount: number;
  totalCount: number;
  allVerified: boolean;
}

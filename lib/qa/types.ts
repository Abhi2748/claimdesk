export interface PolicyCitation {
  id: number;
  sectionLabel: string;
  pageStart: number | null;
  pageEnd: number | null;
  content: string;
  similarity: number;
}

export interface PolicyQAResult {
  answer: string;
  citations: PolicyCitation[];
  /** All chunks returned by match_chunks (even when similarity gate refuses). */
  retrievedChunks: PolicyCitation[];
  refused: boolean;
  topSimilarity: number | null;
}

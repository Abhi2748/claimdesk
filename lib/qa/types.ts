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
  refused: boolean;
  topSimilarity: number | null;
}

export interface TocNode {
  /** Stable depth-first id, e.g. "0001". */
  nodeId: string;
  /** Our section label, e.g. "V.C" — null when the document has none. */
  sectionLabel: string | null;
  title: string;
  /** Printed page numbers (matches chunk page_start / citations). */
  pageStart: number;
  pageEnd: number;
  /** One-sentence summary of this section's content. */
  summary: string;
  nodes: TocNode[];
}

export interface TocTree {
  docDescription: string;
  nodes: TocNode[];
  model: string;
  promptVersion: string;
  generatedAt: string;
}

export interface TocValidationResult {
  ok: boolean;
  errors: string[];
}

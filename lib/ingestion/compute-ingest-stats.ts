import type { PolicyChunk } from "@/lib/ingestion/chunk-policy";
import {
  countPagesWithFooters,
  resolveDocumentTotalPages,
} from "@/lib/ingestion/chunk-policy";
import type { IngestStats } from "@/types/database";

export function computeIngestStats(
  chunks: PolicyChunk[],
  pages: string[],
  pdfTotalPages: number
): IngestStats {
  const labeledCount = chunks.filter((c) => c.sectionLabel !== null).length;

  return {
    chunk_count: chunks.length,
    labeled_ratio: chunks.length > 0 ? labeledCount / chunks.length : 0,
    pages_detected: countPagesWithFooters(pages),
    total_pages: resolveDocumentTotalPages(pages, pdfTotalPages),
  };
}

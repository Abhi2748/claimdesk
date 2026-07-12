import type { SupabaseClient } from "@supabase/supabase-js";
import { embedTexts, embeddingToVector } from "@/lib/embeddings";
import { computeIngestStats } from "@/lib/ingestion/compute-ingest-stats";
import {
  chunkPolicyText,
  maxPrintedPageNumber,
} from "@/lib/ingestion/chunk-policy";
import { extractPdfPages } from "@/lib/ingestion/extract-pdf";
import type { IngestStats } from "@/types/database";

export async function processDocumentIngestion(
  supabase: SupabaseClient,
  documentId: string,
  storagePath: string,
  userId: string
): Promise<{ pageCount: number; chunkCount: number; ingestStats: IngestStats }> {
  const { data: fileData, error: downloadError } = await supabase.storage
    .from("case-documents")
    .download(storagePath);

  if (downloadError || !fileData) {
    throw new Error(`Failed to download PDF: ${downloadError?.message}`);
  }

  const pdfBytes = await fileData.arrayBuffer();
  const { pages, totalPages } = await extractPdfPages(pdfBytes);
  const chunks = chunkPolicyText(pages);
  const policyPageCount = maxPrintedPageNumber(pages) ?? totalPages;
  const ingestStats = computeIngestStats(chunks, pages, totalPages);

  if (chunks.length === 0) {
    throw new Error("No text could be extracted from the PDF.");
  }

  const embeddings = await embedTexts(chunks.map((c) => c.content));

  await supabase.from("chunks").delete().eq("document_id", documentId);

  const rows = chunks.map((chunk, i) => ({
    document_id: documentId,
    created_by: userId,
    section_label: chunk.sectionLabel,
    page_start: chunk.pageStart,
    page_end: chunk.pageEnd,
    content: chunk.content,
    embedding: embeddingToVector(embeddings[i]!),
  }));

  const INSERT_BATCH = 50;
  for (let i = 0; i < rows.length; i += INSERT_BATCH) {
    const batch = rows.slice(i, i + INSERT_BATCH);
    const { error: insertError } = await supabase.from("chunks").insert(batch);
    if (insertError) {
      throw new Error(`Failed to insert chunks: ${insertError.message}`);
    }
  }

  const { error: updateError } = await supabase
    .from("documents")
    .update({
      page_count: policyPageCount,
      ingest_status: "ready",
      ingest_stats: ingestStats,
    })
    .eq("id", documentId);

  if (updateError) {
    throw new Error(`Failed to update document: ${updateError.message}`);
  }

  return {
    pageCount: policyPageCount,
    chunkCount: chunks.length,
    ingestStats,
  };
}

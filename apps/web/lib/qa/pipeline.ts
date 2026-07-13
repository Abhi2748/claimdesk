import type { SupabaseClient } from "@supabase/supabase-js";
import { generatePolicyAnswerFromPassages } from "@/lib/anthropic";
import { embedQuery, embeddingToVector } from "@/lib/embeddings";
import { REFUSAL_MESSAGE } from "@/lib/qa/constants";
import type { PolicyCitation, PolicyQAResult, MatterQAResult } from "@/lib/qa/types";
import {
  QA_TOP_K,
  REFUSAL_SIMILARITY_THRESHOLD,
} from "@/lib/retrieval-config";
import type { MatchChunkResult } from "@/types/database";

/**
 * Production Q&A pipeline: embed → match_chunks → similarity gate → Claude.
 */
export async function answerPolicyQuestion(
  supabase: SupabaseClient,
  documentId: string,
  question: string
): Promise<PolicyQAResult> {
  const trimmed = question.trim();
  if (!trimmed) {
    throw new Error("Question is required.");
  }

  const queryEmbedding = await embedQuery(trimmed);

  const { data: matches, error: rpcError } = await supabase.rpc(
    "match_chunks",
    {
      query_embedding: embeddingToVector(queryEmbedding),
      doc_id: documentId,
      match_count: QA_TOP_K,
      min_similarity: 0,
    }
  );

  if (rpcError) {
    throw new Error(`Search failed: ${rpcError.message}`);
  }

  const chunks = (matches ?? []) as MatchChunkResult[];
  const topSimilarity = chunks[0]?.similarity ?? null;

  const retrievedChunks: PolicyCitation[] = chunks.map((c) => ({
    id: c.id,
    sectionLabel: c.section_label ?? "Section",
    pageStart: c.page_start,
    pageEnd: c.page_end,
    content: c.content,
    similarity: c.similarity,
  }));

  if (
    chunks.length === 0 ||
    (chunks[0]?.similarity ?? 0) < REFUSAL_SIMILARITY_THRESHOLD
  ) {
    return {
      answer: REFUSAL_MESSAGE,
      citations: [],
      retrievedChunks,
      refused: true,
      topSimilarity,
    };
  }

  const citations = retrievedChunks;

  const passages = citations.map((c, i) => ({
    index: i + 1,
    sectionLabel: c.sectionLabel,
    pageStart: c.pageStart,
    pageEnd: c.pageEnd,
    content: c.content,
  }));

  const answer = await generatePolicyAnswerFromPassages(trimmed, passages);
  const refused = answer === REFUSAL_MESSAGE;

  return {
    answer,
    citations: refused ? [] : citations,
    retrievedChunks,
    refused,
    topSimilarity,
  };
}

/**
 * Matter-scoped Q&A: retrieve across ALL ready documents in a case. Additive —
 * the single-document path (used by the eval) is left untouched.
 */
export async function answerMatterQuestion(
  supabase: SupabaseClient,
  caseId: string,
  question: string
): Promise<MatterQAResult> {
  const trimmed = question.trim();
  if (!trimmed) throw new Error("Question is required.");

  const { data: docsData, error: docsError } = await supabase
    .from("documents").select("id, title")
    .eq("case_id", caseId).eq("ingest_status", "ready");
  if (docsError) throw new Error(`Document lookup failed: ${docsError.message}`);

  const sourceDocuments = (docsData ?? []) as { id: string; title: string }[];
  const titleById = new Map(sourceDocuments.map((d) => [d.id, d.title]));
  const emptyRefusal: MatterQAResult = {
    answer: REFUSAL_MESSAGE, citations: [], retrievedChunks: [],
    refused: true, topSimilarity: null, sourceDocuments,
  };
  if (sourceDocuments.length === 0) return emptyRefusal;

  const queryEmbedding = await embedQuery(trimmed);
  const { data: matches, error: rpcError } = await supabase.rpc("match_chunks_multi", {
    query_embedding: embeddingToVector(queryEmbedding),
    doc_ids: sourceDocuments.map((d) => d.id),
    match_count: QA_TOP_K,
    min_similarity: 0,
  });
  if (rpcError) throw new Error(`Search failed: ${rpcError.message}`);

  const rows = (matches ?? []) as (MatchChunkResult & { document_id: string })[];
  const topSimilarity = rows[0]?.similarity ?? null;
  const retrievedChunks: PolicyCitation[] = rows.map((c) => ({
    id: c.id, sectionLabel: c.section_label ?? "Section",
    pageStart: c.page_start, pageEnd: c.page_end, content: c.content,
    similarity: c.similarity, documentId: c.document_id,
    documentTitle: titleById.get(c.document_id) ?? "Document",
  }));

  if (rows.length === 0 || (rows[0]?.similarity ?? 0) < REFUSAL_SIMILARITY_THRESHOLD) {
    return { ...emptyRefusal, retrievedChunks, topSimilarity };
  }

  const passages = retrievedChunks.map((c, i) => ({
    index: i + 1, sectionLabel: c.sectionLabel,
    pageStart: c.pageStart, pageEnd: c.pageEnd, content: c.content,
  }));
  const answer = await generatePolicyAnswerFromPassages(trimmed, passages);
  const refused = answer === REFUSAL_MESSAGE;
  return {
    answer, citations: refused ? [] : retrievedChunks, retrievedChunks,
    refused, topSimilarity, sourceDocuments,
  };
}

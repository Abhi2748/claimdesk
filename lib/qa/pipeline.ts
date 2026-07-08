import type { SupabaseClient } from "@supabase/supabase-js";
import { generatePolicyAnswerFromPassages } from "@/lib/anthropic";
import { embedQuery, embeddingToVector } from "@/lib/embeddings";
import { REFUSAL_MESSAGE } from "@/lib/qa/constants";
import type { PolicyCitation, PolicyQAResult } from "@/lib/qa/types";
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

  if (
    chunks.length === 0 ||
    (chunks[0]?.similarity ?? 0) < REFUSAL_SIMILARITY_THRESHOLD
  ) {
    return {
      answer: REFUSAL_MESSAGE,
      citations: [],
      refused: true,
      topSimilarity,
    };
  }

  const citations: PolicyCitation[] = chunks.map((c) => ({
    id: c.id,
    sectionLabel: c.section_label ?? "Section",
    pageStart: c.page_start,
    pageEnd: c.page_end,
    content: c.content,
    similarity: c.similarity,
  }));

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
    refused,
    topSimilarity,
  };
}

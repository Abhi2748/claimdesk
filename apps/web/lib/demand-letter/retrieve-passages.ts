import type { SupabaseClient } from "@supabase/supabase-js";
import { embedQuery, embeddingToVector } from "@/lib/embeddings";
import type { LetterPassage } from "@/lib/demand-letter/types";
import {
  LETTER_MAX_PASSAGES,
  LETTER_TOP_K_PER_QUERY,
} from "@/lib/retrieval-config";
import type { MatchChunkResult } from "@/types/database";

export async function retrievePassagesForLetter(
  supabase: SupabaseClient,
  documentId: string,
  queries: string[]
): Promise<LetterPassage[]> {
  const chunkMap = new Map<number, MatchChunkResult>();

  for (const query of queries) {
    const embedding = await embedQuery(query);
    const { data, error } = await supabase.rpc("match_chunks", {
      query_embedding: embeddingToVector(embedding),
      doc_id: documentId,
      match_count: LETTER_TOP_K_PER_QUERY,
      min_similarity: 0,
    });

    if (error) {
      throw new Error(`Passage retrieval failed: ${error.message}`);
    }

    for (const chunk of (data ?? []) as MatchChunkResult[]) {
      const existing = chunkMap.get(chunk.id);
      if (!existing || chunk.similarity > existing.similarity) {
        chunkMap.set(chunk.id, chunk);
      }
    }
  }

  return Array.from(chunkMap.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, LETTER_MAX_PASSAGES)
    .map((c) => ({
      sectionLabel: c.section_label ?? "Section",
      pageStart: c.page_start,
      pageEnd: c.page_end,
      content: c.content,
    }));
}

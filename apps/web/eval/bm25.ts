/**
 * Hand-rolled Okapi BM25 over an in-memory chunk set. No new dependency, no
 * DB schema change (no tsvector/GIN index) — built fresh per document from a
 * single content-only select, which is cheap at this corpus size (~300-400
 * chunks/doc). This is retrieval-lab-only code; the live match_chunks path
 * is untouched.
 */

export interface BM25Chunk {
  id: number;
  content: string;
}

const K1 = 1.5;
const B = 0.75;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

export class BM25Index {
  private tokensById = new Map<number, string[]>();
  private termFreqById = new Map<number, Map<string, number>>();
  private docFreq = new Map<string, number>();
  private avgDocLen: number;
  private n: number;

  constructor(chunks: BM25Chunk[]) {
    let totalLen = 0;
    for (const c of chunks) {
      const tokens = tokenize(c.content);
      this.tokensById.set(c.id, tokens);
      totalLen += tokens.length;

      const tf = new Map<string, number>();
      for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
      this.termFreqById.set(c.id, tf);

      for (const t of tf.keys()) {
        this.docFreq.set(t, (this.docFreq.get(t) ?? 0) + 1);
      }
    }
    this.n = chunks.length;
    this.avgDocLen = this.n > 0 ? totalLen / this.n : 0;
  }

  /** Returns chunk ids ranked by BM25 score, highest first, capped at topK. */
  search(query: string, topK: number): { id: number; score: number }[] {
    const queryTerms = tokenize(query);
    const scores: { id: number; score: number }[] = [];

    for (const [id, tf] of this.termFreqById) {
      const docLen = this.tokensById.get(id)!.length;
      let score = 0;
      for (const term of queryTerms) {
        const freq = tf.get(term) ?? 0;
        if (freq === 0) continue;
        const df = this.docFreq.get(term) ?? 0;
        const idf = Math.log((this.n - df + 0.5) / (df + 0.5) + 1);
        const denom =
          freq + K1 * (1 - B + (B * docLen) / (this.avgDocLen || 1));
        score += idf * ((freq * (K1 + 1)) / denom);
      }
      if (score > 0) scores.push({ id, score });
    }

    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK);
  }
}

/**
 * Reciprocal Rank Fusion over N rankings of chunk ids. Standard k=60
 * (the value used in the original RRF paper and Anthropic's Contextual
 * Retrieval writeup).
 */
export function reciprocalRankFusion(
  rankings: { id: number }[][],
  k = 60
): { id: number; score: number }[] {
  const scores = new Map<number, number>();
  for (const ranking of rankings) {
    ranking.forEach((item, idx) => {
      scores.set(item.id, (scores.get(item.id) ?? 0) + 1 / (k + idx + 1));
    });
  }
  return [...scores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Retrieval and ingestion tuning for text-embedding-3-small (1536-dim).
 * REFUSAL_SIMILARITY_THRESHOLD was calibrated against that model's cosine scores.
 */
export const REFUSAL_SIMILARITY_THRESHOLD = 0.35;

export const QA_TOP_K = 6;

/** Per-query top-k when retrieving passages for demand-letter drafting. */
export const LETTER_TOP_K_PER_QUERY = 3;

/** Cap on total passages passed to the letter-generation prompt. */
export const LETTER_MAX_PASSAGES = 12;

export const CHUNK_TARGET_TOKENS = 800;

export const CHUNK_OVERLAP_TOKENS = 100;

"""Hand-rolled Okapi BM25 + Reciprocal Rank Fusion — a faithful Python port
of apps/web/eval/bm25.ts (the harness that measured ADR 004's hybrid-
retrieval numbers). Built fresh per request from a content-only chunk
select, same as the TS version; no new dependency, no DB schema change.

Parity with the TS original is enforced by tests/test_bm25_parity.py against
a shared fixture (apps/web/eval/bm25-parity-fixture.json, generated from the
real TS implementation). Do not change the scoring formula, the tokenizer,
the RRF constant, or the tie-breaking behavior (insertion-order-preserving
dict + stable sort, matching JS Map + stable Array.sort) without
regenerating the fixture and re-validating parity — this module exists
specifically so the live path matches what was benchmarked, not a
reimplementation that happens to be close.
"""

import math
import re
from dataclasses import dataclass

_TOKEN_RE = re.compile(r"[^a-z0-9]+")
_K1 = 1.5
_B = 0.75


def _tokenize(text: str) -> list[str]:
    return [t for t in _TOKEN_RE.split(text.lower()) if len(t) > 1]


@dataclass
class BM25Chunk:
    id: int
    content: str


class BM25Index:
    def __init__(self, chunks: list[BM25Chunk]):
        self._tokens_by_id: dict[int, list[str]] = {}
        self._term_freq_by_id: dict[int, dict[str, int]] = {}
        self._doc_freq: dict[str, int] = {}
        total_len = 0
        for chunk in chunks:
            tokens = _tokenize(chunk.content)
            self._tokens_by_id[chunk.id] = tokens
            total_len += len(tokens)

            tf: dict[str, int] = {}
            for token in tokens:
                tf[token] = tf.get(token, 0) + 1
            self._term_freq_by_id[chunk.id] = tf

            for token in tf:
                self._doc_freq[token] = self._doc_freq.get(token, 0) + 1

        self._n = len(chunks)
        self._avg_doc_len = total_len / self._n if self._n > 0 else 0

    def search(self, query: str, top_k: int) -> list[dict]:
        """Returns [{"id": ..., "score": ...}], highest first, capped at top_k."""
        query_terms = _tokenize(query)
        scores: list[dict] = []

        for chunk_id, tf in self._term_freq_by_id.items():
            doc_len = len(self._tokens_by_id[chunk_id])
            score = 0.0
            for term in query_terms:
                freq = tf.get(term, 0)
                if freq == 0:
                    continue
                df = self._doc_freq.get(term, 0)
                idf = math.log((self._n - df + 0.5) / (df + 0.5) + 1)
                denom = freq + _K1 * (1 - _B + (_B * doc_len) / (self._avg_doc_len or 1))
                score += idf * ((freq * (_K1 + 1)) / denom)
            if score > 0:
                scores.append({"id": chunk_id, "score": score})

        scores.sort(key=lambda s: s["score"], reverse=True)
        return scores[:top_k]


def reciprocal_rank_fusion(rankings: list[list[int]], k: int = 60) -> list[dict]:
    """Standard RRF (k=60, matching the original paper and Anthropic's
    Contextual Retrieval writeup) over N rankings of chunk ids.
    Returns [{"id": ..., "score": ...}], highest fused score first.
    """
    scores: dict[int, float] = {}
    for ranking in rankings:
        for idx, chunk_id in enumerate(ranking):
            scores[chunk_id] = scores.get(chunk_id, 0.0) + 1 / (k + idx + 1)
    return sorted(
        ({"id": chunk_id, "score": score} for chunk_id, score in scores.items()),
        key=lambda s: s["score"],
        reverse=True,
    )

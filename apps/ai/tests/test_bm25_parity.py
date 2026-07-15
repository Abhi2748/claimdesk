"""Hard gate: the Python BM25/RRF port (app/services/bm25.py) must produce
byte-identical rankings to the TS original (apps/web/eval/bm25.ts) on the
shared fixture. If this fails, the port has drifted from what ADR 004
actually benchmarked — fix the port, do not adjust the fixture to match.

Fixture source of truth: apps/web/eval/bm25-parity-fixture.json, generated
by apps/web/scripts/gen-bm25-parity-fixture.ts by running the real TS
implementation (not hand-computed).
"""

import json
from pathlib import Path

import pytest

from app.services.bm25 import BM25Chunk, BM25Index, reciprocal_rank_fusion

FIXTURE_PATH = (
    Path(__file__).resolve().parents[2]
    / "web"
    / "eval"
    / "bm25-parity-fixture.json"
)


@pytest.fixture(scope="module")
def fixture():
    if not FIXTURE_PATH.exists():
        pytest.fail(
            f"Parity fixture not found at {FIXTURE_PATH}. Regenerate with "
            "`pnpm exec tsx scripts/gen-bm25-parity-fixture.ts` in apps/web."
        )
    with open(FIXTURE_PATH, encoding="utf-8") as f:
        return json.load(f)


def _assert_rankings_equal(actual: list[dict], expected: list[dict]) -> None:
    assert len(actual) == len(expected), (
        f"ranking length mismatch: got {len(actual)}, expected {len(expected)}"
    )
    for a, e in zip(actual, expected):
        assert a["id"] == e["id"], f"id order mismatch: got {a['id']}, expected {e['id']}"
        assert a["score"] == pytest.approx(e["score"], rel=1e-9, abs=1e-12), (
            f"score mismatch for id {a['id']}: got {a['score']}, expected {e['score']}"
        )


class TestBM25Parity:
    def test_bm25_rankings_match_ts(self, fixture):
        chunks = [BM25Chunk(id=c["id"], content=c["content"]) for c in fixture["chunks"]]
        index = BM25Index(chunks)
        top_k = fixture["topK"]

        for query in fixture["queries"]:
            actual = index.search(query, top_k)
            expected = fixture["expectedBm25"][query]
            _assert_rankings_equal(actual, expected)


class TestRRFParity:
    def test_rrf_fusion_matches_ts(self, fixture):
        for case in fixture["expectedRrf"]:
            actual = reciprocal_rank_fusion(case["rankings"], case["k"])
            _assert_rankings_equal(actual, case["expected"])

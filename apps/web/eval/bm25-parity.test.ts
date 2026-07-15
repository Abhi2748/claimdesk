import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BM25Index, reciprocalRankFusion } from "./bm25";

/**
 * Regression check for eval/bm25-parity-fixture.json — the fixture the
 * Python port (apps/ai/app/services/bm25.py) is validated against in
 * apps/ai/tests/test_bm25_parity.py. If this test ever fails, the fixture
 * is stale (bm25.ts changed after the fixture was generated) — regenerate
 * via scripts/gen-bm25-parity-fixture.ts and re-validate the Python port,
 * don't just update the fixture blindly.
 */
interface Fixture {
  chunks: { id: number; content: string }[];
  queries: string[];
  topK: number;
  expectedBm25: Record<string, { id: number; score: number }[]>;
  expectedRrf: {
    label: string;
    k: number;
    rankings: number[][];
    expected: { id: number; score: number }[];
  }[];
}

const fixture: Fixture = JSON.parse(
  readFileSync(resolve(__dirname, "bm25-parity-fixture.json"), "utf-8")
);

describe("bm25.ts matches its own frozen parity fixture", () => {
  const index = new BM25Index(fixture.chunks);

  for (const query of fixture.queries) {
    it(`BM25 ranking is stable for: "${query}"`, () => {
      const actual = index.search(query, fixture.topK);
      assert.deepEqual(actual, fixture.expectedBm25[query]);
    });
  }

  for (const rrfCase of fixture.expectedRrf) {
    it(`RRF fusion is stable for: ${rrfCase.label}`, () => {
      const actual = reciprocalRankFusion(
        rrfCase.rankings.map((ids) => ids.map((id) => ({ id }))),
        rrfCase.k
      );
      assert.deepEqual(actual, rrfCase.expected);
    });
  }
});

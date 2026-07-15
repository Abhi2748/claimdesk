import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { verifyCitations } from "./verify";
import type { PolicyCitation, VerificationResult } from "./types";

/**
 * Regression check for eval/verify-parity-fixture.json — the fixture the
 * Python port (apps/ai/app/services/verify.py) is validated against in
 * apps/ai/tests/test_verify_parity.py. If this test ever fails, the fixture
 * is stale (verify.ts changed after the fixture was generated) — regenerate
 * via scripts/gen-verify-parity-fixture.ts and re-validate the Python port,
 * don't just update the fixture blindly.
 */
interface Fixture {
  chunks: PolicyCitation[];
  cases: { label: string; answer: string }[];
  expected: Record<string, VerificationResult>;
}

const fixture: Fixture = JSON.parse(
  readFileSync(resolve(__dirname, "../../eval/verify-parity-fixture.json"), "utf-8")
);

describe("verify.ts matches its own frozen parity fixture", () => {
  for (const c of fixture.cases) {
    it(`verification is stable for: ${c.label}`, () => {
      const actual = verifyCitations(c.answer, fixture.chunks);
      // JSON round-trip normalizes `source: undefined` (present as an own
      // key on the live object literal) the same way the fixture's own
      // JSON.stringify already dropped it when generated.
      assert.deepEqual(JSON.parse(JSON.stringify(actual)), fixture.expected[c.label]);
    });
  }
});

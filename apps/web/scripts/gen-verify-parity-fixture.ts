/**
 * Generates the citation-verifier port-parity fixture consumed by:
 *   - apps/web/lib/qa/verify.test.ts (existing TS behavior test — unchanged)
 *   - apps/ai/tests/test_verify_parity.py (Python port parity — hard gate
 *     before the coverage agent's verify_and_score node, ADR 009, relies on
 *     the port)
 *
 * Ground truth is the real, already-validated lib/qa/verify.ts
 * implementation — the fixture is generated FROM it, not hand-computed, so
 * parity failures in the Python port are unambiguous (the port is wrong,
 * not the fixture). Cases cover: exact match, parent-section match, wrong
 * page, page-range overlap, no-page citation, dedup, non-citation bracket,
 * a non-roman-numeral bracket with a page, and a null-pageStart chunk.
 *
 * Run: pnpm exec tsx scripts/gen-verify-parity-fixture.ts
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { verifyCitations } from "../lib/qa/verify";
import type { PolicyCitation } from "../lib/qa/types";

const CHUNKS: PolicyCitation[] = [
  {
    id: 1,
    sectionLabel: "III.B.8 Special Limits",
    pageStart: 6,
    pageEnd: 6,
    content: "Special limits of liability apply to certain categories of personal property.",
    similarity: 0.91,
  },
  {
    id: 2,
    sectionLabel: "II.A Definitions",
    pageStart: 4,
    pageEnd: 5,
    content: "Flood means a general and temporary condition of partial or complete inundation.",
    similarity: 0.87,
  },
  {
    id: 3,
    sectionLabel: "III.D.2 Limit of Liability",
    pageStart: 8,
    pageEnd: 8,
    content: "The policy will pay up to $30,000 under Coverage D, in addition to Coverage A.",
    similarity: 0.82,
  },
  {
    id: 4,
    sectionLabel: "VI.C The deductible does NOT apply to:",
    pageStart: null,
    pageEnd: null,
    content: "A list of coverages exempt from the standard deductible.",
    similarity: 0.63,
  },
  {
    id: 5,
    sectionLabel: "V.A.6 The cost of complying with any",
    pageStart: 12,
    pageEnd: 12,
    content: "Ordinance-or-law compliance costs are excluded except as provided under Coverage D.",
    similarity: 0.71,
  },
];

interface Case {
  label: string;
  answer: string;
}

const CASES: Case[] = [
  { label: "exact-match-verified", answer: "Special limits apply [III.B.8, p.6]." },
  { label: "invented-section-unverified", answer: "Coverage exists [IX.Z.1, p.99]." },
  { label: "parent-section-matches-child-chunk", answer: "See [III.B, p.6]." },
  { label: "right-section-wrong-page-unverified", answer: "See [III.B.8, p.40]." },
  { label: "deduped-repeated-markers", answer: "[III.B.8, p.6] and [III.B.8, p.6]" },
  { label: "non-citation-bracket-ignored", answer: "A note [see below]." },
  { label: "page-range-overlap-verified", answer: "[II.A, p.3-4]" },
  {
    label: "multiple-mixed-citations",
    answer:
      "Coverage D pays up to $30,000 [III.D.2, p.8], but ordinance compliance is otherwise excluded [V.A.6, p.12], except a phantom rule [IX.Z.1, p.99].",
  },
  { label: "no-page-citation-label-only", answer: "The deductible exemption list applies [VI.C]." },
  {
    label: "non-roman-bracket-with-page-unverified",
    answer: "As discussed above [Note, p.2], coverage is limited.",
  },
  {
    label: "null-page-start-chunk-always-overlaps",
    answer: "Certain coverages are exempt from the deductible [VI.C, p.14].",
  },
];

function main() {
  const expected: Record<string, ReturnType<typeof verifyCitations>> = {};
  for (const c of CASES) {
    expected[c.label] = verifyCitations(c.answer, CHUNKS);
  }

  const fixture = {
    chunks: CHUNKS,
    cases: CASES,
    expected,
  };

  const outPath = resolve(process.cwd(), "eval/verify-parity-fixture.json");
  writeFileSync(outPath, JSON.stringify(fixture, null, 2) + "\n", "utf-8");
  console.log(`Wrote ${outPath}`);
}

main();

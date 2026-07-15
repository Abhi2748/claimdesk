/**
 * Generates the BM25/RRF port-parity fixture consumed by:
 *   - apps/web/eval/bm25-parity.test.ts (TS regression check)
 *   - apps/ai/tests/test_bm25_parity.py (Python port parity — hard gate
 *     before wiring hybrid retrieval into the live matter-QA path)
 *
 * Ground truth is the real, already-validated eval/bm25.ts implementation —
 * the fixture is generated FROM it, not hand-computed, so parity failures
 * in the Python port are unambiguous (the Python port is wrong, not the
 * fixture). Chunks are synthetic but realistic (flood-policy-style prose
 * with deliberate vocabulary overlap) so BM25 has meaningful signal to
 * differentiate on.
 *
 * Run: pnpm exec tsx scripts/gen-bm25-parity-fixture.ts
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { BM25Index, reciprocalRankFusion } from "../eval/bm25";

const CHUNKS = [
  { id: 1, content: "Flood, as used in this flood insurance policy, means a general and temporary condition of partial or complete inundation of two or more acres of normally dry land area or of two or more properties." },
  { id: 2, content: "We will pay you for direct physical loss by or from flood to your insured building or personal property if you have purchased the appropriate coverage." },
  { id: 3, content: "The deductible does NOT apply to the cost of removing debris, the cost of complying with an increased cost of compliance provision, or condominium loss assessments." },
  { id: 4, content: "Personal property in a building that is not fully enclosed must be secured to prevent flotation out of the building during a flood event." },
  { id: 5, content: "Coverage A - Building Property covers the insured building, its foundation, and permanently installed fixtures such as plumbing and electrical systems." },
  { id: 6, content: "Coverage B - Personal Property covers personal belongings that are inside the fully enclosed insured building at the time of the flood loss." },
  { id: 7, content: "Sandbags, supplies, and labor used to protect the insured building from flood water are covered up to the limit shown in the declarations page." },
  { id: 8, content: "Any renewal certificate indicating that coverage has been bound is subject to the terms and conditions of the standard flood insurance policy." },
  { id: 9, content: "This policy insures only one building. If you own more than one building, each building requires a separate policy and a separate premium payment." },
  { id: 10, content: "Assessments made by a condominium association against unit owners for a flood loss to commonly owned building elements may be covered under Coverage D." },
  { id: 11, content: "When a building insured under this policy is a residential condominium building, the association's policy is primary over any unit owner's policy." },
  { id: 12, content: "Requirements in case of loss include prompt written notice, protecting the property from further damage, and separating damaged from undamaged property for inspection." },
  { id: 13, content: "Appraisal is available if you and we disagree on the amount of loss; each party selects a competent, impartial appraiser and the two appraisers select an umpire." },
  { id: 14, content: "If an insured building has been flooded by rising waters continuously for 90 days or more, this policy will pay the lesser of the building limit or the deductible amount." },
  { id: 15, content: "Water that backs up through sewers or drains is covered only when a flood, as defined by this policy, is the proximate cause of the sewer or drain backup." },
];

const QUERIES = [
  "How does this policy define a flood?",
  "Which coverages are not subject to the deductible?",
  "Can a condo association get paid before the building is rebuilt?",
  "Is personal property covered if the building isn't fully enclosed?",
  "Does the policy cover sewer backup during a flood?",
];

const TOP_K = 10;

function main() {
  const bm25 = new BM25Index(CHUNKS.map((c) => ({ id: c.id, content: c.content })));

  const expectedBm25: Record<string, { id: number; score: number }[]> = {};
  for (const q of QUERIES) {
    expectedBm25[q] = bm25.search(q, TOP_K);
  }

  // RRF test cases, including a deliberate score tie (ids 6 and 9 both
  // ranked 3rd in one list, absent from the other at the same relative
  // position) to pin down tie-breaking behavior (must be a stable sort
  // over insertion order in both languages).
  const rrfCases = [
    {
      label: "two-list-fusion",
      rankings: [
        [5, 1, 7, 2, 9, 6, 3],
        [1, 7, 5, 6, 2, 9, 8],
      ],
      k: 60,
    },
    {
      label: "three-list-fusion-with-partial-overlap",
      rankings: [
        [14, 15, 2, 1, 12],
        [15, 3, 14, 4],
        [2, 14, 1, 15, 3, 12],
      ],
      k: 60,
    },
    {
      label: "disjoint-lists",
      rankings: [
        [1, 2, 3],
        [4, 5, 6],
      ],
      k: 60,
    },
    {
      label: "explicit-tie",
      rankings: [
        [10, 11],
        [11, 10],
      ],
      k: 60,
    },
  ];

  const expectedRrf = rrfCases.map((c) => ({
    label: c.label,
    k: c.k,
    rankings: c.rankings,
    expected: reciprocalRankFusion(
      c.rankings.map((ids) => ids.map((id) => ({ id }))),
      c.k
    ),
  }));

  const fixture = {
    chunks: CHUNKS,
    queries: QUERIES,
    topK: TOP_K,
    expectedBm25,
    expectedRrf,
  };

  const outPath = resolve(process.cwd(), "eval/bm25-parity-fixture.json");
  writeFileSync(outPath, JSON.stringify(fixture, null, 2), "utf-8");
  console.log(`Wrote ${outPath}`);
  console.log(`${QUERIES.length} BM25 queries, ${rrfCases.length} RRF cases, ${CHUNKS.length} chunks.`);
}

main();

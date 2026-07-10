# ClaimDesk

**AI-native case management for policyholder-side insurance law — with citations you can trust.**

Built solo in one sprint, in the exact stack a modern legal-tech product runs on: Next.js 16 (App Router) · TypeScript · Supabase (Postgres, Auth, Storage, RLS, pgvector) · Anthropic Claude · Vercel.

> **Live demo:** [URL] · **4-minute walkthrough:** [Loom link]
> All client data is fictional. The insurance policy analyzed is a real, public federal document: the NFIP Standard Flood Insurance Policy, Dwelling Form F-122 (October 2021).

---

## The problem

Attorneys who represent policyholders against insurance carriers live inside two documents: the client's policy (60–100 pages of dense, hierarchical legalese) and the insurer's lowball or denial letter. Answering "is this covered, and up to how much?" means an hour of page-flipping, and drafting the demand letter that follows means two more. An AI assistant can collapse that to minutes — but only if it never invents a provision, because a demand letter citing a section that doesn't exist loses the firm's credibility in one click.

ClaimDesk is a working slice of that product: a case workspace where an attorney uploads a policy, asks coverage questions and gets answers with pinpoint section-and-page citations (or an honest refusal), generates a first-draft demand letter that can only cite provisions actually present in the policy, and sees jurisdiction-aware deadlines — all behind row-level security, all measured by an eval suite that gates every change.

## What it does

**Case workspace.** Cases with claim type, insurer, state, dates, amounts, and a status pipeline; document upload into private storage; five seeded fictional matters across KY, TX, FL, TN, and MT.

**Policy Q&A with citations and refusal.** Upload a policy → structure-aware ingestion chunks it along the document's own section hierarchy (with true printed page numbers parsed from page footers) → pgvector retrieval → Claude answers strictly from retrieved passages, citing `[Section, p.N]` for every claim. Two independent refusal layers: a retrieval-similarity gate that declines before the model is even called, and a prompt-layer contract that returns exactly "I can't find this in the policy." when the evidence doesn't support an answer. In testing, the refusal answer returns in ~1.5s versus 5–13s for substantive answers — the cheap gate is also the fast path.

![Policy Q&A with section and page citations](images/Maria%27s%20Q%26A.png)

**Demand letter drafting with dynamic retrieval planning.** Instead of hardcoded lookups, a planning step reads the case facts and generates the retrieval queries for *this* claim: the flood case plans NFIP proof-of-loss and federal-suit-limitation queries; the Texas hail case plans "hail damage exclusions cosmetic roof Texas" and appraisal-clause queries. The plan is persisted with every letter and displayed in the UI — explainability, not just logging. Hard drafting rules: cite only provisions verbatim present in retrieved passages; if the passages don't affirmatively support coverage for the claimed peril, omit the coverage argument and flag for attorney review; cases with no policy document get a clean facts-and-damages letter. Every letter carries a prompt version and an attorney-review banner.

*NFIP flood case (Maria Reyes) — retrieval plan tailored to federal flood policy:*

![NFIP flood case retrieval plan](images/maria%20case%20retrieval%20queries%20for%20draft.png)

*Texas hail case (Daniel Okafor) — different peril, different queries:*

![Texas hail case retrieval plan](images/Daniel%20Okafor%20retrieval%20queires%20for%20draft.png)

**Deadline tracking that knows NFIP is different.** Flood claims under the NFIP are governed by a one-year federal suit limitation running from written denial, filed in US District Court — state statutes of limitation do not control (SFIP §VII.O, p.22, the one rule in the table verified from the policy text itself). Other jurisdictions show computed deadlines from clearly-labeled demo data with verify-before-relying disclaimers.

![Case details and jurisdiction-aware deadline tracker](images/deadline%20card.png)

## The eval suite (the part I'm proudest of)

Before writing any pipeline code, I read the full 30-page policy and wrote a 20-question golden test set with verified answers and citations — including deliberate traps: a burst-pipe question where naive RAG confidently answers wrong (the correct answer requires the policy's definition of "flood" plus an exclusion), a mudflow-vs-landslide question that requires connecting a definition to an exclusion that applies "even if caused by flood," an additional-living-expenses question where *refusing* is the failure (the policy explicitly excludes it), and a liability question the policy never addresses, where anything but refusal is a severe failure.

**Current result: 17/20 pass, 0 severe failures.** Scoring is strict: a pass requires citing the exact expected section; a severe failure is an invented citation or a substantive answer to a must-refuse question.

| Outcome | Count | Notes |
|---|---|---|
| PASS | 17/20 | includes all five designed trap questions |
| FAIL | 3/20 | all three are citation-granularity / similarity-vs-relevance retrieval misses; answers were substantively correct or honestly hedged, never fabricated |
| SEVERE | 0/20 | no invented citations; refusal contract intact |

**The eval earned its keep three times in one afternoon.** It detected a silent no-op deployment (identical similarity scores across runs revealed the re-indexing never took effect). It caught chunks inserted without embeddings — invisible to search, invisible to eyeballing. And most importantly, it **rejected one of my own improvements**: a multi-granularity chunking experiment lifted the score to 18/20 — including fixing the hardest question — but broke the refusal contract with one severe failure. Per the gate's hard constraints, I reverted the change and shipped 17/0 instead of 18/1; the experiment lives on a branch as the seed of the retrieval roadmap below. For a legal tool, a system that fails honestly beats a system that occasionally invents.

## Retrieval Lab

**Similarity is not relevance: benchmarking retrieval strategies on real insurance policies.**

The golden set is the same 20 questions as the eval suite. Two retrieval strategies run head-to-head on each: **pgvector similarity** (production baseline) and **ToC tree navigation** (bounded walk over an extracted table of contents, then label-hierarchy fetch). Results are precomputed offline — the live app reads `eval/lab-data.json`, not live model calls. Open **`/lab`** after sign-in (demo or normal user) to explore side-by-side answers, citation chips, and the tree **navigation path** rendered as breadcrumbs — the explainability centerpiece.

| Strategy | Pass | Trap catch | SEVERE | Median latency |
|---|---:|---:|---:|---:|
| Vector (pgvector) | 17/20 | 85% | 0 | ~6.7s |
| Tree (ToC nav) | 15–16/20* | ~80% | 0 | ~11.5s |
| Oracle hybrid† | 18/20 | 90% | 0 | ~11.5s |

\*Tree pass rate varies 15–16/20 across runs due to LLM sampling at navigation hops; **SEVERE=0** and refusal behavior are stable.

†Oracle hybrid = PASS if **either** strategy passes on a question — the headline number neither strategy alone reaches.

**Complementarity.** Vector and tree miss *different* questions. Vector fails when surface wording points away from the controlling section (similarity ≠ legal relevance). Tree fails when the navigator picks a plausible but wrong branch, or when citation granularity doesn't match the scorer's exact label. Together they cover 18/20 — evidence that a hybrid router (cheap vector first, tree on low-confidence or trap questions) could beat either alone without touching the refusal contract.

**Failure taxonomy (all non-severe).**
- **Similarity miss** — high embedding score on the wrong section; answer substantively right but missing the exact required cite (e.g. Q4 basement items, Q13 IV.14).
- **Navigator branch error** — tree walks to a related but non-controlling node; still grounded, wrong section label.
- **Citation granularity** — answer cites parent section when scorer expects a sub-clause (or vice versa).

Regenerate lab data: `npm run export-lab` (requires `DOC_ID`, eval credentials, API keys).

## Architecture notes

**Security is enforced at the database layer.** Every table carries Row Level Security scoped to the owning user; the storage bucket is private with owner-only policies; the vector-search RPC runs as SECURITY INVOKER so RLS applies inside retrieval too. Even a bug in application code cannot serve one client's documents to another user.

**Chunking follows the document's own structure.** Insurance policies are hierarchical legal machines; chunks are cut along the policy's section seams and carry section labels plus true printed page numbers (parsed from "PAGE N OF M" footers — the PDF's file page index is off by the front matter, a bug this project found the hard way when a drafted letter cited correct quotes with wrong section numbers). A structural-consistency rule resolves the classic Roman-numeral-vs-letter ambiguity ("I. No Benefit to Bailee" under Section VII is the letter I, not a new Section I: after VII, only VIII can follow).

**Grounding prevents fabrication — not misapplication.** An adversarial test (drafting a hail-claim letter against a deliberately mismatched flood policy) produced a letter whose every citation was real but whose coverage argument was wrong: retrieval returned peril-neutral passages that "looked supportive." The fix is a coverage gate in the drafting prompt plus exclusion-targeted planning queries; the deeper fix is on the roadmap. Layered defenses, each catching a different failure class: retrieval gate → grounding prompt → coverage gate → eval traps → attorney-review banner.

## Honest limitations & roadmap

The three remaining vector eval failures share one root cause: **similarity is not relevance.** Embedding retrieval ranks passages by vocabulary resemblance, and questions whose surface wording points away from their legal subject (a "what will the policy pay" question retrieving loss-*settlement* sections instead of the basement-*items* provisions) can miss the controlling text. The Retrieval Lab (see above) benchmarks a ToC tree navigator against this baseline; neither alone reaches the oracle hybrid score. Next milestone: a **hybrid router** that keeps vector latency for easy lookups and escalates to tree navigation on trap questions or low-confidence retrieval — still gated by the same golden set.

Also on the roadmap: multi-format ingestion (the current parser is calibrated to this document family; ingestion-quality metrics flag low-confidence documents rather than silently degrading), LLM-generated document trees for format-agnostic structure extraction, a legal-domain embeddings A/B (voyage-law-2), DOCX export, and CI that runs the eval on every prompt change.

Known scope cuts, deliberately: single-document depth over multi-document breadth; no OCR for scanned PDFs; state deadline data is demo-labeled, not legal advice.

## Running locally

Clone; `npm install`; create a Supabase project with the `vector` extension enabled; run `supabase/migrations/*.sql` in order (create your auth user first and paste its UUID into the seed block of 001); copy `.env.example` to `.env.local` and fill in Supabase URL/anon key, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` (embeddings), and eval credentials; `npm run dev`. Run the eval with `npm run eval` — results land in `eval/results.md`, failure transcripts in `eval/transcripts.md`. Populate the Retrieval Lab with `npm run export-lab`, then open `/lab`.

---

*Built by Abhishek Reddy Gorla — [GitHub] · [email] · [LinkedIn]*
*Fictional demo. Not legal advice. The NFIP policy form is a public FEMA document analyzed for demonstration.*

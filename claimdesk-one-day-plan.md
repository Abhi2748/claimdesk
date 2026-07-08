# ClaimDesk — One-Day Build Plan
**Goal:** Ship a live, deployed AI case-management demo for policyholder-side insurance law (targeting the Denham Property & Injury Law job) in ONE day, then send the application + direct outreach.

**Builder:** Abhishek Reddy Gorla (MS Data Science, CU Boulder; strong LangChain/LangGraph/RAG/eval background; new to Next.js).
**Tools:** Claude (planning, explanations, unblocking) + Cursor (code generation) + you (decisions, testing, shipping).

---

## 1. What we're building (one sentence)
A web app where an attorney opens a fictional case, uploads a real specimen insurance policy, asks coverage questions and gets **cited, refusal-capable answers**, generates a first-draft **demand letter** that only cites real provisions, and sees **state-specific deadlines** — built in Denham's exact stack.

**Stack:** Next.js 15 (App Router) + TypeScript + Supabase (Postgres, Auth, Storage, RLS, pgvector) + Anthropic API + Vercel.

**Demo story (fictional):** Maria Alvarez, Lexington KY. Burst pipe Jan 12. Insurer "Shield Mutual" offered $9,000 on $42,000 of damage. Firm handles demand stage.

---

## 2. Scope — FULL SCOPE, strictly sequenced (nothing cut; order is non-negotiable)

We build EVERYTHING. The rule that replaces cutting: **build in tiers, finish a tier completely before starting the next.** At the end of any tier, the product is deployable and demo-able. Never work on Tier 2 while Tier 1 has a broken feature.

### Tier 1 — The Complete Core (target: today, ~hours 0–12)
1. Case workspace: cases table, status pipeline, document upload, seed data across Denham's states (KY, TN, FL, TX, MT)
2. Policy Q&A: pgvector RAG over one real specimen policy, answers with section/page citations, **hard refusal** when the answer isn't in the document
3. Demand letter drafter: case facts + retrieved provisions → Claude draft → editable → export (DOCX or copy-to-clipboard fallback)
4. Deadline tracker: lookup table of limitation periods for ~6 states, auto-computed dates from date of loss, red warning inside 90 days
5. Mini eval: 10 golden questions, scripted pass/fail run, results table in README
6. RLS on every table
7. Deployed on Vercel; README drafted

### Tier 2 — The Differentiator (target: tonight if energy allows, else tomorrow AM, ~4–6 hrs)
8. Tree-search retrieval (PageIndex-style, vectorless): TOC-tree of the policy, Claude navigates it to select sections
9. Bake-off: run the same golden set through vector vs tree retrieval; comparison table (accuracy, endorsement-trap catch, latency, cost) goes in README
10. Second + third specimen policies ingested (different formats) to prove the pipeline generalizes; expand golden set to ~20 questions

### Tier 3 — The Authenticity Layer (target: tomorrow, ~3–4 hrs)
11. Court-exhibit hunt on CourtListener for 1–2 real denial/demand letters; refine the fictional denial letter and the demand-letter prompt against real patterns
12. UI polish pass, empty states, loading states
13. Final Loom re-record if Tier 2/3 changed the demo story

### Shipping gates (can fire at the end of ANY tier)
- **Gate A (end of Tier 1):** Loom + README + resume update + TestGorilla application + direct email. FIRE THIS GATE WITHIN 24 HOURS NO MATTER WHAT — a strong Tier 1 already beats other applicants, and you can send a "I've since added a retrieval benchmark" follow-up later (which is itself a great second touchpoint).
- **Gate B (end of Tier 2/3):** update README + repo; if application already sent, send the short follow-up email with the benchmark results.

### Definition of DONE today
Tier 1 fully working on a live URL + Loom recorded + application ready to send. Tiers 2–3 done today if humanly possible, tomorrow otherwise — but they are DONE either way, not dropped.

---

## 3. Hour-by-hour schedule (~12–13 focused hours)

| Block | Hours | Work |
|---|---|---|
| A | 0–1 | Setup: create Next.js app, Supabase project, Anthropic key, push to GitHub, **deploy empty skeleton to Vercel immediately** (deploy early = no 11pm deploy panic) |
| B | 1–2 | Data: download 1 specimen policy PDF (see §4), skim its table of contents 20 min, write the 10 golden questions (§5) |
| C | 2–4 | Database: schema + RLS + seed script (5 fictional cases incl. Maria) + Supabase Storage upload wired into UI |
| D | 4–7 | The core: PDF text extraction → section-aware chunking → embeddings → pgvector → Q&A endpoint with citations + refusal threshold → simple chat UI on the case page |
| E | 7–9 | Demand letter: server action assembling case facts + top retrieved provisions → Claude draft → editable textarea → export |
| F | 9–10 | Deadline tracker: statutes lookup table + computed deadlines + warning badges |
| G | 10–11 | Eval: script runs 10 golden questions through the pipeline, checks must-cite / must-refuse constraints, prints pass/fail table |
| H | 11–12.5 | Polish, reseed clean demo data, final deploy, record Loom, write README |
| I | +0.5 | Update resume bullets, submit TestGorilla application, send direct outreach email (§9) |

**Rule of the day:** if any block runs >30 min over, cut within that block, don't steal from later blocks. Blocks D and G are the least cuttable.

---

## 4. Data (fast, legal, real)
- **Policy PDF (pick ONE):**
  - FEMA NFIP Dwelling Policy — free official PDF on fema.gov (search "NFIP dwelling form policy PDF"). Clean structure, genuinely real.
  - OR a state Department of Insurance specimen homeowners (HO-3) policy — search "specimen homeowners policy site:.gov" or a state DOI consumer page.
- **Denial letter:** write ONE realistic fictional letter (Shield Mutual → Maria: cites wear-and-tear + late-notice, offers $9,000). Ask Claude to draft it from real-world patterns.
- **Deadlines table:** compile breach-of-contract / property-claim limitation periods for KY, TN, IN, FL, TX, MT from official statute sites. Store with source URL per row. Add a UI disclaimer: "Demo data — verify before relying."
- **Everything client-related is fictional. Say so in README and app footer.**

## 5. Golden questions (write in Block B, exact wording depends on chosen policy)
Cover these categories — roughly:
1–3. Clearly answered coverage questions (must cite the correct section)
4–5. Exclusion questions (must cite the exclusion)
6–7. Definition questions ("how does the policy define 'flood'/'dwelling'?")
8. A trap: topic the policy NEVER addresses (e.g., rental car) → **must refuse**
9. An endorsement/amendment question if the policy has one
10. Demand-letter constraint: every section cited in a generated letter must exist in the source policy (checked by script)

Format per question: `{question, must_cite: [sections], must_refuse: bool, notes}`

## 6. Database schema (minimum)
- `cases`: id, title, client_name, claim_type (fire/water/wind_hail/denied/underpaid), insurer, policy_number, state, date_of_loss, status (intake/investigation/demand/litigation/resolved), created_by
- `documents`: id, case_id, storage_path, doc_type (policy/denial_letter/estimate/other), title, page_count
- `chunks`: id, document_id, section_label, page_start, page_end, content, embedding vector
- `deadline_rules`: state, claim_type, period_months, description, source_url
- `letters`: id, case_id, content, model, prompt_version, created_at
- `eval_cases` + `eval_runs` (or keep evals as JSON in repo — fine for today)
- **RLS on all tables** (owner = auth.uid()); storage bucket private with signed URLs

## 7. AI pipeline decisions (pre-made so you don't stall)
- Embeddings: any solid option available today (e.g., Voyage or OpenAI text-embedding-3-small) — pick one, don't compare
- Chunking: split on the policy's own headings (SECTION/COVERAGE/EXCLUSIONS/CONDITIONS/ENDORSEMENT patterns), keep section_label + page numbers on every chunk; fallback to ~800-token chunks with overlap where headings fail
- Retrieval: top 6 by cosine similarity; if best score < threshold (tune ~0.3–0.4) → refuse without calling the model
- Answering: Claude with strict system prompt: answer ONLY from provided passages; cite section + page for every claim; if not supported, reply exactly "I can't find this in the policy."
- Letter prompt: inputs = case facts JSON + retrieved provisions; instruction: cite only provided provisions; output structured demand letter. Keep `prompt_version` string on saved letters.

## 8. Tier 2 build notes — tree-search retrieval + bake-off (scheduled, not optional)
Build order once Tier 1 is fully green:
1. **Tree builder:** parse the policy's headings into a JSON tree `{title, section_label, page_start, page_end, children[], summary}` — one-time Claude pass can generate node summaries. Store the tree as JSONB on the `documents` row.
2. **Navigator:** a small loop where Claude sees the tree (titles + summaries only), reasons about which branch(es) answer the question, drills down max 2–3 hops, and returns selected section IDs. Fetch those sections' full text as the context for answering. Log the navigation path — that path IS the explainability story.
3. **Bake-off harness:** the eval script from Tier 1 gets a `--retriever=vector|tree` flag. Run both on the full golden set. Record per question: correct citation (Y/N), refusal correctness, endorsement-trap caught (Y/N), latency, token cost. Output a markdown table straight into README.
4. **Multi-policy:** ingest 2 more specimen policies with different layouts; fix whatever breaks in parsing (something will — that's the point); expand golden set to ~20.
Design rationale to state in README regardless of results: insurance policies are hierarchical legal machines where endorsements override earlier sections and similarity ≠ relevance — reasoning-based retrieval is the natural fit hypothesis, and we test it with numbers instead of vibes.

## 9. Shipping checklist (Blocks H–I)
- README sections: problem → demo GIF/screenshots → architecture diagram → schema → how citations & refusal work → eval results table → security (RLS, private storage, fictional data) → what I'd build next → local setup
- Loom (3–4 min, narrate to an ATTORNEY): open Maria's case → ask covered question (show citation, click to passage) → ask trap question (show refusal — say "this is the most important feature") → generate demand letter → show deadline warning → 20 seconds on eval gate
- Resume: add ClaimDesk as top project; work "Next.js" into skills, backed by this repo
- Apply via TestGorilla link from the posting
- Direct email to the firm (short): built a working prototype of AI policy analysis + demand drafting for policyholder firms in your exact stack (Next.js/TypeScript/Supabase) — live demo URL + 4-min video + GitHub. 3 sentences max, no attachments needed.

## 10. How to resume in a new chat
Paste: "I'm building ClaimDesk per my one-day plan (attach this file). I'm at Block ___. Here's my current problem: ___." Attach this document. Claude re-loads full context instantly.

## 11. Working agreement for today
- Cursor writes code; Claude explains, unblocks, reviews decisions; you test every feature by hand as Maria's attorney would
- Any bug that resists for >25 min: paste the error + file into chat, move on to a parallel task while we solve it
- No new features get invented today. The plan is the plan.

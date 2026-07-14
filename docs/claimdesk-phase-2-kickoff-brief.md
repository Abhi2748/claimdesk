# ClaimDesk — Act Three, Phase 2 Kickoff Brief (for a fresh build chat)

Paste this whole file into the new chat as the first message, and attach: (a) the
current repo zip, and (b) the latest `claimdesk-act-three-build-log.md` (updated
through Phase 1 in the Phase-1 chat). Tell the new chat: **"Start at Phase 2,
Block 2.1. Inspect the repo zip first — don't assume its state. Work
block-by-block in the established style. Search for current (2026) best methods
before locking any technical choice — don't default to plain LLM/RAG."**

Phase 0 (foundations) and Phase 1 (case spine + policy intelligence) are COMPLETE
and live. This brief covers Phase 2 (the AI trust core) and scopes Phase 3
(production hardening) for a later hand-off.

---

## 1. Product & philosophy (unchanged)

Multi-tenant, AI-native case OS for policyholder-side property-insurance disputes.
Flagship value = **trustworthy, cited policy intelligence** with a hard refusal
contract. This is a portfolio/flagship build optimizing for **demonstrating
senior capability** (LLMOps, evals-in-CI, agents, multi-tenant security, clean
service boundaries, observability). Depth of *how it's built* and the ability to
**defend every technical choice with evidence** beats breadth of features.

## 2. Working style (follow exactly)

Assistant gives Cursor prompts + acceptance tests + SQL migrations; **user
executes in Cursor / Supabase / Render / Vercel and reports back.** The eval
gates every retrieval/prompt change (**SEVERE = auto-reject**). Timeboxes; each
block ends demoable; **update the build log after every block**. Keep the user in
plain language and part of decisions; **sub-step big/risky blocks**; one demoable
increment at a time. **Before locking any technical choice, web-search for the
current 2026 state of the art and benchmark on our own data — the whole point is
to be able to defend choices to a technical interviewer.** Record every such
decision as an ADR with a measured scorecard (see §5A — this is a core Phase 2
deliverable, not an afterthought).

## 3. Locked decisions for Phase 2

- **Full trust core** — includes the hybrid retrieval router (not deferred).
- **Coverage agent built on LangGraph** (durable state, checkpointing,
  human-in-the-loop, auditability — the recognizable, defensible choice; the
  Anthropic Agent SDK was the simpler alternative, consciously not chosen).
- Carry-overs from Phase 0/1 all still hold: two-service monorepo, all-Supabase
  auth, strangler-fig migration, typed contract (Pydantic→OpenAPI→TS).

## 4. Where Phase 1 left things (verify against the zip)

Live product: create a matter → upload a policy → ask cross-document questions →
get verified citations. Shipped: matters CRUD (kept the `cases` table),
**org-scoped document storage**, a **server-side citation verifier** (green
"verified" / amber "couldn't verify" + trust bar + § section tabs), a **review
queue** (`/review`, generic), and the **eval cut over to run against the Python
`apps/ai` service** (still 17/20, 0 SEVERE; `apps/ai` locked to accept calls only
from the web app). CI's `DOC_ID` pin is set; demo data refreshed/clean.

**IMPORTANT split-brain to fix first:** the **eval now runs against the Python
service, but the live "Ask the matter" feature still runs its AI logic inside the
website.** So the automated gate guards a *different code path* than users hit.
Closing the strangler-fig (below) re-aligns them — do it early in Phase 2.

## 5. Research-backed technical direction (2026 SOTA — build THESE, not generic versions)

The new chat should still verify with fresh searches, but this is the intended
direction and why:

- **Retrieval upgrade = Anthropic's Contextual Retrieval + hybrid + reranking.**
  (1) Prepend a short LLM-generated context to each chunk before embedding;
  (2) hybrid search = dense vectors + BM25 keyword, fused (e.g. reciprocal rank
  fusion); (3) a cross-encoder **reranker** (Cohere Rerank / Voyage / BGE /
  Qwen3-reranker) over the top ~20 → best ~5. Anthropic reports ~49% fewer
  retrieval failures, ~67% with reranking. Also evaluate **semantic chunking**
  vs the current fixed-size.
- **Embedding model = benchmark, don't assume.** Current is
  `text-embedding-3-small` (fine, cheap). Stronger 2026 options to benchmark on
  our corpus: Gemini Embedding, Voyage 3/4, Cohere Embed v4 (multimodal),
  open-weight Qwen3-Embedding-8B / BGE-M3. Decide by data. **Keep the F-122 path
  frozen** as the control; any change is eval-gated.
- **Document extractor = doc-AI / VLM, not plain LLM.** Benchmark the current
  rules-based parser against **Docling** (IBM, open-source, self-hostable) and/or
  a VLM parser (LlamaParse / Mistral OCR / Reducto) on our own docs. Pick by
  measured extraction accuracy. F-122 path stays frozen for the eval.
- **Multi-document eval corpus.** Add **real public policy forms** (FEMA NFIP
  General Property form, a state-DOI specimen, an ISO-style homeowners form —
  real forms, fictional case data) with golden Q&A per doc. This is what makes
  "tested on many formats, not one" true and defensible. It also seeds the
  retrieval benchmark and the router.
- **Hybrid retrieval router.** Route each question to the best retriever
  (vector / PageIndex tree / hybrid) based on benchmark evidence; report it as a
  range (retrieval is non-deterministic) and prove it beats any single retriever
  (the Act Two "oracle-hybrid 18/20" story, productized).
- **Coverage agent = LangGraph**, stateful, with structured cited output
  (does the policy cover this claim? conditions/exclusions, each with a
  citation), **grounding/confidence scores**, and **human-in-the-loop** via the
  existing review queue. Trace every node in Langfuse.
- **Trust dashboard** surfaces grounding scores, verification rates, and the
  retrieval-benchmark leaderboard in-product.

## 5A. Decision discipline — measure, record, and defend every choice (the "legit company" practice)

Phase 2 isn't just "build the smart version" — it's "be able to **defend every
architectural choice with evidence** to a recruiter." So every non-trivial
technical decision is treated the way a real engineering team treats it: measured,
recorded, justified. **Do NOT add a component because it's state of the art.
Default to the simplest option that meets the quality bar; add complexity only
when the data proves it earns its place.** (The user's example: a reranker adds
accuracy but also latency and an API call per query — keep it only if the measured
gain justifies the cost, and maybe only for the query types that need it. The same
skepticism applies to every component below.)

**Produce an ADR (Architecture Decision Record) for each decision** — a short
`docs/decisions/NNN-title.md` file plus a one-line pointer in the build log —
containing: the question, the options considered, a **scorecard** of measurements,
the decision, the rationale, and "what would change this decision."

**Scorecard factors** (measure the ones relevant to each decision):
- Quality — the eval/benchmark delta, and on *which* question types (not just the
  overall number)
- Latency — added ms per request (p50/p95)
- Cost — per-query token/API cost + one-time indexing cost + any infra/GPU
- Complexity & maintainability — moving parts, new failure modes
- Operational burden — self-host vs API, another vendor/key, data residency
- Determinism/variance & reversibility (how easily rolled back)

**Ablation discipline for the retrieval stack (the headline recruiter artifact):**
measure the **marginal** contribution of each component, not just the final stack:
baseline → +hybrid (BM25) → +contextual chunks → +reranker → +router. Keep only
the pieces that earn their latency/cost. Cost levers to factor in rather than using
headline per-token rates: **prompt caching** cuts repeated-input cost ~90% and
**batch** jobs ~50%.

**Set budgets up front** so decisions have a target: an acceptable per-query
**latency budget** and **cost budget** for the live Q&A and for the agent.

**Decision points that each need an ADR + scorecard** (not exhaustive — record any
others that arise):
1. Embedding model (3-small vs Gemini/Voyage/Cohere v4/Qwen3/BGE) — incl.
   re-embedding cost, dimensions/storage, API vs self-host.
2. Chunking strategy (fixed vs semantic vs contextual).
3. Contextual Retrieval (index-time LLM cost vs failure reduction).
4. Hybrid search (add a BM25 sparse index? which fusion method).
5. Reranker (which model; API vs self-host; **does it earn its latency**, and for
   which query types).
6. Retrieval router (routing overhead vs always-hybrid; how it decides).
7. Document parser (rules-based vs Docling self-host vs VLM/API — accuracy vs
   cost-per-page vs latency vs data residency).
8. Per-task model choice (answerer, the cheap contextualizer, the agent's
   reasoning model, the LLM-as-judge) — cost/quality per role.
9. Coverage-agent shape (single-agent vs multi-agent; number of LangGraph nodes) —
   avoid over-engineering; more steps = more cost/latency/failure surface.
10. Grounding-score method (LLM-as-judge vs similarity vs the verifier) — cost of
    scoring every answer.
11. Vector store / index (keep pgvector? document why).

Every one of these becomes a line in the interview story: "I tested X, Y, Z; here's
the measured tradeoff; here's why I chose what I chose — and here's what would make
me change it."

## 6. Phase 2 — proposed blocks (confirm/refine against the repo first)

- **2.1 — Finish the cutover + signup + landing.** Move the live cross-document
  Q&A (+ verifier) onto `apps/ai` behind the typed contract (forward JWT for
  RLS); re-align eval and live. **Add public self-serve signup** (Supabase
  `signUp` + email confirmation) — currently there's no way to create an account
  — and a **marketing/landing page** so visitors understand the product before
  logging in. Keep 17/20.
- **2.2 — Retrieval Lab v2 (the defensible benchmark).** Build the multi-document
  real-policy golden corpus; benchmark embedding models × chunk strategies ×
  Contextual Retrieval × hybrid (dense+BM25) × reranker, on our own data. Output is
  a leaderboard **with cost + latency columns, not just accuracy**, an **ablation**
  showing each component's marginal value, and an **ADR per decision** (see §5A) —
  so every retrieval choice is defensible. Set the latency/cost budgets here first.
  Sub-step this. (This is the block that turns "I picked these values" into "I
  measured and chose these values, and here's what would change them.")
- **2.3 — Hybrid retrieval router.** Implement + benchmark the per-question
  router; prove it beats each retriever alone.
- **2.4 — Smarter document extractor.** Doc-AI/VLM structure extraction
  (benchmark Docling vs VLM vs current), tested against a fictional "hard" doc
  and the new real forms. F-122 path frozen.
- **2.5 — Coverage agent (LangGraph).** Structured, cited coverage opinion +
  grounding scores + review-queue integration; fully traced.
- **2.6 — In-product trust dashboard.** Grounding/verification/benchmark surfaced
  in the app. Demoable: a structured cited coverage opinion + a PR blocked by the
  eval gate.

## 7. Invariants that must NEVER break

- **Eval baseline 17/20, 0 SEVERE.** Every retrieval/prompt/agent change keeps
  0 SEVERE and doesn't regress pass count. Refusal contract string exactly:
  `I can't find this in the policy.`
- **F-122 pipeline is the frozen control** — new retrieval/extraction techniques
  are benchmarked on the *new* corpus and adopted only if the eval proves them;
  don't silently change the frozen path.
- **Frozen QA values** unless the eval gates a change: model `claude-sonnet-4-6`;
  embeddings `text-embedding-3-small` (1536); `QA_TOP_K = 6`;
  `REFUSAL_SIMILARITY_THRESHOLD = 0.35`; `max_tokens = 2048`.
- **RLS is tested with a real authenticated client**, never the Supabase SQL
  editor (it bypasses RLS as admin AND mis-impersonates with null `auth.uid()`).
- Demo stays read-only in its own org; keep one policy doc in `default` to keep
  `resolveDocumentId` unambiguous (or pin `DOC_ID`). Fictional case data only;
  real *public* policy forms are OK.

## 8. Key facts (so the new chat doesn't guess)

- Live AI service: `https://claimdesk-zkqi.onrender.com` (`/health` → ok);
  `POST /qa/answer`; Langfuse v4 tracing, fail-open, **US region**
  (`https://us.cloud.langfuse.com`).
- Monorepo: Turborepo + pnpm; `apps/web` (Next.js 16.2.10 / React 19.2.4 / TS;
  Vercel root dir `apps/web`; middleware is `proxy.ts`; honor `AGENTS.md`, read
  `node_modules/next/dist/docs/` before touching Next internals), `apps/ai`
  (Python 3.12 / FastAPI, Render), `@claimdesk/types` (generated contract),
  `pnpm gen:types` / `check:types` (keep cross-platform).
- DB: Supabase, multi-tenant (`organizations`, `memberships` role
  owner/admin/member, `audit_log`); org-scoped RLS on `cases`/`documents`/
  `chunks`/`letters` via `user_org_ids()` etc.; migrations through **011** (next
  is `012`). Users: `abhireddy1333@gmail.com` (owner, `default` org, id
  `507e369b-a842-40ff-aeda-05c66a30b8bb`), `demo@claimdesk.app` (`demo` org, id
  `d110bfd1-41f2-46e6-acd8-425286585b01`).
- CI: GitHub Actions — `checks` + path-filtered `eval-gate` (`EVAL_CI=1`, fails on
  SEVERE>0 or PASS<17). Making the eval a required merge check is a small carried
  CI tweak.
- Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `EVAL_USER_*`, `DEMO_USER_*`,
  `LANGFUSE_*`. New Phase-2 keys likely: a reranker/embedding provider key
  (Cohere/Voyage/etc.) and possibly a doc-parser key — put them in `apps/ai/.env`,
  Render env, and CI secrets as needed.

## 9. Phase 3 — production hardening (scope now, hand off later)

The same decision discipline (§5A) applies here — guardrail library, PII tool,
online-eval approach, and monitoring stack each get an ADR + scorecard. After
Phase 2, hand a fresh chat these (all have 2026 standards — search first):
- **Guardrails** mapped to OWASP LLM Top 10 / NIST AI RMF: input validation,
  **indirect prompt-injection defense on uploaded documents** (the sharp threat
  for this app), PII redaction (Presidio/LLM-Guard), formalize the citation
  verifier as a groundedness rail, topic/scope enforcement, tool-call gating for
  the agent. Tools to evaluate: NeMo Guardrails, Guardrails AI, LLM Guard,
  Llama/Prompt Guard.
- **Online evals + feedback loops:** sample live traffic, LLM-as-judge
  groundedness/faithfulness, route user thumbs + "couldn't verify" flags into the
  review queue and back into the golden set; drift/anomaly alerts (grounding
  drop, refusal-rate shift, cost spike).
- **Versioning + rollback:** prompt/model/agent versions via Langfuse prompt
  registry (deployment labels) + Git; safe rollout + rollback.
- **Error handling + observability:** Sentry (app) + Langfuse (AI), structured
  logging, alerting.
- **CI/CD hardening:** eval as a required merge check, preview environments, safe
  deploys; dependency/secret scanning; RLS audit.
- **Context management at scale:** hierarchical retrieval + reranking + contextual
  compression to handle many/large documents within a token budget.

## 10. When Phase 2 is done

Bring the results + updated build log back to the planning chat to spin up the
Phase 3 brief the same way. Later roadmap (from the original plan): deadlines +
demand-package generator, client portal, deeper security/SOC-2 readiness.

# ClaimDesk

**AI-native case OS for policyholder-side property insurance attorneys — with citations you can trust.**

ClaimDesk is a multi-tenant workspace for firms that fight underpaid, denied, and delayed property claims (fire, water, wind, hail, hurricane). Attorneys open a matter, upload the real policy forms, ask coverage questions with pinpoint section-and-page citations (or an honest refusal), generate a structured coverage opinion for human review, and draft a demand letter that can only cite provisions actually present in the retrieved text.

| | |
|---|---|
| **Repository** | [github.com/Abhi2748/claimdesk](https://github.com/Abhi2748/claimdesk) |
| **Web app** | Next.js on Vercel — open `/login` → **View the live demo** (read-only · fictional data · no signup) |
| **AI service** | FastAPI on Render — [`https://claimdesk-zkqi.onrender.com/health`](https://claimdesk-zkqi.onrender.com/health) |
| **Accuracy Lab** | `/lab` after sign-in — public proof of retrieval quality |
| **Decisions** | [`docs/decisions/`](docs/decisions/) — 10 ADRs |

> Demo client data is fictional. Policy forms analyzed are real, public FEMA/NFIP documents (Dwelling Form F-122, General Property Form F-123, Residential Condominium Building Association Policy F-144).

---

## Architecture

Two services, one product surface:

```
Browser  →  Next.js BFF (apps/web, Vercel)
              ├─ Auth session, org RLS, case UI, review queue
              └─ Forward user JWT  →  Python AI service (apps/ai, FastAPI / Render)
                                        ├─ /qa/answer, /qa/matter
                                        ├─ /coverage/analyze  (LangGraph, 202 Accepted)
                                        └─ Hybrid retrieve (dense + BM25) · Claude · Langfuse
```

**Web (`apps/web`).** Next.js 16 (App Router) · React 19 · TypeScript · Turborepo + pnpm monorepo. Supabase Auth + Postgres + Storage + pgvector. Middleware lives in `proxy.ts` (Next 16 convention). Shared OpenAPI contract: `@claimdesk/types`.

**AI (`apps/ai`).** Python 3.12 · FastAPI. Matter Q&A and the LangGraph coverage agent run here so retrieval/prompt work stays off the Next.js request path. The coverage endpoint returns **202 Accepted** immediately; the opinion is written to `coverage_opinions` and a `review_items` row — never auto-approved.

**Data & tenancy.** Org-scoped multi-tenant RLS (`user_org_ids()` and related helpers), RBAC, MFA, and an audit log. The public demo user is read-only in its own org. Migrations live under `apps/web/supabase/migrations/`.

**Observability.** Langfuse v4 tracing (US region), fail-open on the request path.

**CI.** GitHub Actions: `checks` (lint/typecheck/build) plus a path-filtered `eval-gate` (`EVAL_CI=1`) that fails on `SEVERE > 0` or `PASS < 17` for the frozen F-122 control set.

---

## What it does

1. **Matter + client workspace** — caseload, dispute amounts, multi-document PDF upload, ingest status, jurisdiction-aware deadline tracking (NFIP federal limitation called out explicitly).
2. **Ask the matter** — hybrid retrieval across every ready document; answers cite `[Section, p.N]` or refuse with the exact string `I can't find this in the policy.` Citations are machine-verified against retrieved source text (green verified / amber unverified).
3. **Coverage opinion** — LangGraph graph (`retrieve → draft_opinion → verify_and_score → write_review_queue`) produces a structured verdict (`covered` / `excluded` / `partial` / `unclear`) with cited findings and grounding scores, always queued for human review.
4. **Demand letter draft** — planning step generates claim-specific retrieval queries; draft cites only provisions present in retrieved passages; coverage arguments omitted when evidence doesn’t support them.

---

## Engineering evidence

The product differentiator is measured trust, not feature count. Decisions live in [`docs/decisions/`](docs/decisions/) (10 ADRs). Highlights:

### Multi-document golden corpus

A **43-question** golden set across three real NFIP forms (F-122, F-123, F-144), including designed traps where the correct behavior is refusal. Scoring is strict: invented citations or answering a must-refuse question are **SEVERE**.

### Ablation → shipped hybrid retrieval

Block 2.2 ran the ladder discipline from the Phase 2 brief — keep a component only when measured quality gain beats latency/cost on *this* corpus:

| Stage | Result | ADR |
|---|---|---|
| Dense baseline | ~74% pass | 003 |
| + hybrid (BM25 + RRF) + chunking/top-K | **90.7%** (39/43) | 003–004 |
| + refusal-string exactness fix | **41/43**, **0 SEVERE** | 005 |
| Shipped to live matter Q&A | **37/43 → 41/43**, 0 SEVERE (within latency/cost budgets) | 007 |

### What we deliberately skipped

**Contextual Retrieval and a cross-encoder reranker were not built** ([ADR 006](docs/decisions/006-skip-contextual-retrieval-and-reranker.md)). With 0 SEVEREs left and budgets still holding headroom, those rungs had no measured failure mode left to fix — building them would have added cost, latency, and operational burden without evidence. A router/extractor upgrade was similarly skipped ([ADR 008](docs/decisions/008-skip-router-and-extractor-upgrade.md)).

The frozen F-122 control path remains the eval gate: **17/20 PASS, 0 SEVERE** minimum on every change that could affect retrieval or prompts.

### Coverage agent

Benchmark and shape in [ADR 009](docs/decisions/009-coverage-agent-shape-and-budget.md) / [ADR 010](docs/decisions/010-coverage-retrieve-topk-ablation.md): background job (~20s p50), 4-node LangGraph, human review queue only.

---

## Running locally

```bash
git clone https://github.com/Abhi2748/claimdesk.git
cd claimdesk
pnpm install
```

**Web (`apps/web`)**

1. Create a Supabase project (enable `vector`). Run `apps/web/supabase/migrations/*.sql` in order.
2. Copy env into `apps/web/.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `AI_BASE_URL`, `DEMO_USER_*`, eval credentials as needed.
3. `pnpm --filter web dev` → [http://localhost:3000](http://localhost:3000)

**AI (`apps/ai`)**

1. Python 3.12 venv; install deps from `apps/ai`.
2. Env in `apps/ai/.env` (keep `ANTHROPIC_API_KEY` here — not in the global shell — if you use a Claude subscription for agent work).
3. `uvicorn app.main:app --port 8000` (or point `AI_BASE_URL` at the Render deploy).

### Useful commands

| Command | Purpose |
|---|---|
| `pnpm --filter web dev` | Next.js dev server |
| `pnpm --filter web build` / `lint` / `typecheck` | Web quality gates |
| `pnpm --filter web eval` | Frozen F-122 golden eval (must stay ≥17/20, 0 SEVERE) |
| `pnpm --filter web test` | Unit tests (scoring, verify, BM25 parity) |
| `pnpm gen:types` / `pnpm check:types` | Regenerate / drift-check OpenAPI → `@claimdesk/types` |

---

## Docs map

| Doc | What it is |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) / [`AGENTS.md`](AGENTS.md) | Operating invariants for agents and humans |
| [`docs/build-log.md`](docs/build-log.md) | Engineering history |
| [`docs/decisions/`](docs/decisions/) | ADRs (budgets, ablations, skips, coverage agent) |
| [`docs/phase-2-brief.md`](docs/phase-2-brief.md) / progress notes | Phase 2 scope |

---

*Built by Abhishek Reddy Gorla — [GitHub](https://github.com/Abhi2748/claimdesk)*  
*Fictional demo. Not legal advice. NFIP forms are public FEMA documents analyzed for demonstration.*

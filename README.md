# ClaimDesk

Case workspace for policyholder-side insurance attorneys — answers from the actual policy, with citations you can verify, or an honest refusal.

Upload a case’s policies, ask coverage questions across every ready document, generate a structured coverage opinion for human review, and draft a demand letter that can only cite provisions actually retrieved from the text.

| | |
|---|---|
| **Website** | [claimdesk-sage.vercel.app](https://claimdesk-sage.vercel.app/) |
| **Live demo** | Deployed app → `/login` → **View the live demo** (read-only · fictional cases · no signup) |
| **Accuracy Lab** | Public `/lab` — retrieval quality on a real golden set |
| **AI health** | [claimdesk-zkqi.onrender.com/health](https://claimdesk-zkqi.onrender.com/health) |

Demo client data is fictional. Policy forms used in evals are public FEMA/NFIP documents (F-122, F-123, F-144). **Not legal advice.**

---

## Features

- **Case workspace** — clients, disputes, multi-document upload, ingest status, deadline tracking
- **Ask the case** — hybrid retrieval (dense + BM25); section+page citations; exact refusal when evidence isn’t there
- **Coverage opinion** — LangGraph agent → `covered` / `excluded` / `partial` / `unclear`, cited findings, human review queue (never auto-approved)
- **Demand letter draft** — claim-specific retrieval plan; cites only provisions present in retrieved passages
- **Trust rails** — machine citation verification (verified / unverified), org-scoped RLS, RBAC, MFA, audit trail, demo read-only mode

---

## Why trust it

ClaimDesk optimizes for *measured* policy intelligence, not chat volume:

| Signal | Result |
|---|---|
| Multi-doc golden set (3 NFIP forms) | **41/43** PASS, **0** SEVERE (live case Q&A path) |
| Frozen F-122 CI gate | ≥ **17/20** PASS, **0** SEVERE on every relevant change |
| Coverage agent golden set | **8/10** PASS, **0** SEVERE |
| Intentionally skipped | Contextual retrieval + reranker — measured budgets already cleared without them |

SEVERE = invented citation or answering a must-refuse question. Failures that remain are primarily exact citation-label misses — not fabrications.

---

## Stack

```
Browser → Next.js (Vercel)  →  FastAPI AI service (Render)
            Supabase Auth / Postgres / Storage / pgvector
            Org RLS · JWT forward · Langfuse (fail-open)
```

| Layer | Choice |
|---|---|
| Monorepo | Turborepo + pnpm (`apps/web`, `apps/ai`, `packages/types`) |
| Web | Next.js 16 · React 19 · TypeScript |
| AI | Python 3.12 · FastAPI · LangGraph · Claude Sonnet · OpenAI embeddings |
| Data | Supabase (multi-tenant RLS, MFA, audit) |
| CI | Lint / typecheck / tests + path-filtered eval gate |

---

## Quick start

```bash
git clone https://github.com/Abhi2748/claimdesk.git
cd claimdesk
pnpm install
```

**Web**

1. Create a Supabase project (enable the `vector` extension). Apply `apps/web/supabase/migrations/*.sql` in order.
2. Configure `apps/web/.env.local` (`NEXT_PUBLIC_SUPABASE_*`, `AI_BASE_URL`, API keys, demo/eval credentials as needed).
3. `pnpm --filter web dev` → [http://localhost:3000](http://localhost:3000)

**AI service**

1. Python 3.12 venv in `apps/ai`; install package extras from `pyproject.toml`.
2. Configure `apps/ai/.env`.
3. `uvicorn app.main:app --port 8000` — or point `AI_BASE_URL` at the Render deploy.

```bash
pnpm --filter web lint typecheck build
pnpm --filter web eval          # frozen F-122 control (≥17/20, 0 SEVERE)
pnpm --filter ai test
pnpm check:types                # OpenAPI ↔ @claimdesk/types drift check
```

---

## Architecture decisions

Significant technical choices (retrieval budgets, ablations, what we skipped, coverage agent, guardrails) are written up as ADRs under [`docs/decisions/`](docs/decisions/).

---

## License & disclaimer

Built by [Abhishek Reddy Gorla](https://github.com/Abhi2748).

Fictional demo. Not legal advice. NFIP forms are public FEMA documents analyzed for demonstration.

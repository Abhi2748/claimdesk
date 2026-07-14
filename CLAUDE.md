@AGENTS.md

# ClaimDesk — Claude Code Operating Manual (read every session)

## What this is
A multi-tenant, AI-native case OS for policyholder-side property-insurance disputes.
Flagship value = **trustworthy, cited policy intelligence** with a hard refusal
contract. This is a portfolio build optimizing for demonstrating senior
capability; **being able to defend every technical choice with evidence beats
adding features.** Phase 0 (foundations) and Phase 1 (case spine + policy
intelligence) are DONE and live. We are now on **Phase 2** (see
`docs/phase-2-brief.md`).

## How we work (non-negotiable rhythm)
- Work **block-by-block**, one demoable increment at a time. **Sub-step any big
  or risky block.**
- **The eval is the gate.** After ANY change to retrieval, prompts, or AI logic,
  run it (`pnpm --filter web eval`). **A SEVERE result = auto-reject — stop and
  revert.** Never regress below the 17/20 baseline.
- **Checkpoint before committing:** show the diff and the eval result and wait
  for the human's OK. **Do NOT run unattended across many blocks** — stop at each
  block boundary. Bigger strides than a single prompt, yes; an hours-long
  unchecked marathon, no.
- After each block: update `docs/build-log.md`, and for any technical choice,
  write an **ADR** in `docs/decisions/NNN-title.md`.
- Explain decisions in **plain language** — the human is non-specialist in some
  layers and wants to weigh in.

## Invariants — NEVER break these
- **Eval 17/20, 0 SEVERE** minimum. Refusal contract exact string:
  `I can't find this in the policy.` `must_refuse` questions must still refuse.
- **The F-122 pipeline is the FROZEN control.** Benchmark new retrieval/extraction
  techniques on the NEW multi-document corpus; never silently change the frozen
  path. Frozen values unless the eval gates a change: model `claude-sonnet-4-6`,
  embeddings `text-embedding-3-small` (1536 dims), `QA_TOP_K=6`,
  `REFUSAL_SIMILARITY_THRESHOLD=0.35`, `max_tokens=2048`.
- **RLS is tested ONLY with a real authenticated client** (a signed-in throwaway
  script), NEVER the Supabase SQL editor — it bypasses RLS as admin (false
  positives) and mis-impersonates with null `auth.uid()` (false zeros).
- **Demo user stays read-only in its own org.** Fictional case data only; real
  *public* policy forms (FEMA/state DOI/ISO) are OK.
- Never commit secrets or `.env` files. Never proceed past a broken eval or a
  failing RLS isolation check.

## Decision discipline (a core deliverable, not an afterthought)
- **Do NOT add a component because it's "state of the art."** Default to the
  simplest option that clears the quality bar; add complexity only when measured
  data proves it earns its place (e.g. a reranker only if its accuracy gain beats
  its added latency/cost — maybe only for the query types that need it).
- For each non-trivial choice: **search the current 2026 best method, benchmark
  on OUR data, and write an ADR** with a scorecard covering quality / latency /
  cost / complexity / operational burden / reversibility, the decision, and
  "what would change this."
- For the retrieval stack, run an **ablation** (baseline → +hybrid(BM25) →
  +contextual chunks → +reranker → +router) and keep only what earns its
  latency/cost. **Set latency + cost budgets first.**

## Stack facts
- **Monorepo:** Turborepo + pnpm. `apps/web` (Next.js 16.2.10 / React 19.2.4 /
  TS; Vercel; middleware is `proxy.ts` — read `node_modules/next/dist/docs/`
  before touching Next internals; don't "modernize"). `apps/ai` (Python 3.12 /
  FastAPI; live on Render `https://claimdesk-zkqi.onrender.com`, `/health`).
  `@claimdesk/types` = generated contract; keep `pnpm gen:types` / `check:types`
  cross-platform.
- **Commands:** `pnpm --filter web dev|build|lint|typecheck|eval`; `apps/ai`:
  `uvicorn app.main:app --port 8000`.
- **DB (Supabase):** org-scoped multi-tenant RLS via `user_org_ids()` etc.;
  migrations through **014** (next is `015`). Users: `abhireddy1333@gmail.com`
  (owner, `default` org, id `507e369b-a842-40ff-aeda-05c66a30b8bb`),
  `demo@claimdesk.app` (`demo` org, id `d110bfd1-41f2-46e6-acd8-425286585b01`).
  Run SQL in the Supabase SQL editor; test RLS with a real client.
- **Observability:** Langfuse v4 tracing, fail-open, US region
  (`https://us.cloud.langfuse.com`).
- **CI:** GitHub Actions — `checks` + path-filtered `eval-gate` (`EVAL_CI=1`,
  fails on SEVERE>0 or PASS<17).

## The plan
- `docs/phase-2-brief.md` — what to build now (AI trust core). Read it at the
  start of the phase.
- `docs/build-log.md` — full engineering history; keep appending.
- `docs/decisions/` — ADRs. Later: `docs/phase-3-brief.md` (production hardening).

## Billing note (for the human)
Use the Claude subscription, not API billing: ensure `ANTHROPIC_API_KEY` is only
in `apps/ai/.env`, not in the global shell, or Claude Code will bill per-token.

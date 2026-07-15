# ClaimDesk — Act Three Build Log (Platform Rebuild)

Continuation of the Act One + Act Two build logs. Same rules carried over:
eval gates every retrieval/prompt change (SEVERE = auto-reject for anything on
the prod path); fictional data only; the public demo stays read-only; timeboxes
are law; each block ends demoable; the log is updated after every block.

Act Three's mission: evolve ClaimDesk from a single-document demo into a
multi-tenant, AI-native case operating system for policyholder-side property
insurance disputes — going deep on the AI + trust + security core. Locked
decisions (from the kickoff): two-service monorepo (Next.js BFF + Python AI);
all-Supabase auth (RLS-first, MFA, append-only audit); focused sprint on
Phases 0–2; brand stays ClaimDesk.

---

## Phase 0 — Foundations (skeleton)

### Block 0.1 ✅ — Monorepo skeleton (Turborepo + pnpm)

**What it does:** Converted the single Next.js app into a Turborepo + pnpm
monorepo. The entire existing app was lifted into `apps/web` **unchanged**, and
empty-but-valid scaffolds were created for the new pieces: `apps/ai` (Python +
FastAPI stub), and `packages/{ui, types, config}`. This was a deliberately
**zero-logic-change structural move** — no application code, SQL, prompts, or
eval logic was touched.

**Layout:**
```
claimdesk/
  apps/
    web/    ← entire Next.js app (imports intact; types/ + .env.local live here)
    ai/     ← FastAPI stub, GET /health → {"status":"ok"} (Python 3.12, .venv)
  packages/
    ui/     ← placeholder (Act-Two components extracted later)
    types/  ← placeholder + gen:types no-op stub (real codegen lands in 0.2)
    config/ ← placeholder (shared eslint/tsconfig/tailwind later)
  pnpm-workspace.yaml   turbo.json   package.json (root turbo scripts only)
  AGENTS.md   CLAUDE.md (kept at root as workspace rules)
```

**Key decisions:**
- **Two-service split begins.** Next.js stays the BFF/UI; a Python FastAPI
  service will own all LLM logic. The service boundary + typed contract is the
  senior-signal decision. In 0.1 the Python side is a `/health` stub only.
- **Strangler-fig, not big-bang.** The existing TypeScript AI core keeps
  running and the app stays live. Retrieval / QA / tree / ingestion port to
  Python endpoint-by-endpoint across Phases 1–2; the eval flips to hitting the
  FastAPI endpoint as each path moves. Rationale: the deployed app is the
  shipped artifact — it must never go dark during the rebuild.
- **Typed contract = Pydantic → OpenAPI → TS.** Single source of truth will be
  the Pydantic models in `apps/ai`; FastAPI emits `/openapi.json`;
  `openapi-typescript` generates TS into `packages/types`; CI fails if the
  checked-in types are stale (drift guard). Nothing to generate yet in 0.1, so
  `gen:types` is a no-op stub.
- **The eval is the pin.** The harness moved *with* the app into `apps/web` so
  its relative imports (`eval/ → ../lib/qa/pipeline`) still resolve and the gate
  keeps passing through the refactor.

**Proof the lift was clean (acceptance):**
- `pnpm --filter web eval` → **17/20, 0 SEVERE** — identical to pre-move. This is
  the load-bearing check: the refactor changed structure, not behavior.
- `pnpm --filter web build` → success (Next.js 16.2.10, all routes compiled).
- `tsc --noEmit` (apps/web) → exit 0.
- `apps/ai` boots via uvicorn; `GET /health` → `{"status":"ok"}`.
- `package-lock.json` removed; `pnpm-lock.yaml` committed; 6 workspace projects
  resolve.

**Honest deviations from the plan (all correct):**
- `types/` moved into `apps/web/` — required for `@/types/*` imports to resolve.
- `.env.local` / `.env.example` moved into `apps/web/` — the eval reads
  `cwd/.env.local`.
- `AGENTS.md` / `CLAUDE.md` kept at repo root as workspace-wide agent rules.

**Known issues carried into Phase 0 (must clear before the CI gate goes green):**
1. **Pre-existing lint error** — `apps/web/types/database.ts:260`
   `@typescript-eslint/no-empty-object-type`. File was only moved, not changed;
   error predates Act Three. Must be fixed before the CI lint gate can be green.
2. **pnpm not on PATH / corepack EPERM** — install had to run via
   `npx pnpm@9.15.9`. Resolve (global pnpm or working corepack) for reproducible
   local + CI installs.
3. **Vercel root directory** — must be changed to `apps/web` in the Vercel
   dashboard before the next deploy, or the live demo 404s. Operational step,
   not code.

**Interview talking point:** "My first move on the platform rebuild was a
zero-logic-change structural lift into a two-service monorepo, gated by the
eval — 17/20 before and 17/20 after proved the refactor touched no behavior. I
kept the shipped app live and chose a strangler-fig port over a big-bang
rewrite, so the demo never goes dark."

---

### Block 0.2 ✅ — First Python endpoint (`POST /qa/answer`)

**What it does:** Ported the production policy-Q&A pipeline from TypeScript into
`apps/ai` (FastAPI) as a **behavior-identical** endpoint, running alongside the
live app. Strangler-fig: `apps/web` was not edited (eval only regenerated its
results files). This is the first proof the two-service split works end-to-end
for a real feature.

**Structure:** `app/{main,config,constants}` + `schemas/qa.py` (Pydantic
`PolicyQARequest` / `PolicyCitation` / `PolicyQAResponse` — the future contract
source of truth) + `routers/{health,qa}` + `services/{embeddings, anthropic,
supabase_client, qa_pipeline}` + `scripts/get_test_ids.py`.

**Faithful-port discipline (why it worked):** system prompt, model
(`claude-sonnet-4-6`), `top_k=6`, `threshold=0.35`, `max_tokens=2048`, passage
format, and the refusal string were copied **verbatim** from the TS source —
not "improved." RLS preserved: the endpoint requires a Bearer user JWT and
queries Supabase as that user (no service-role bypass), mirroring the eval's
signed-in session.

**Acceptance (all pass):**
- `GET /health` → `{"status":"ok"}`.
- Answerable ("How does this policy define a flood?") → `refused=false`,
  `top_similarity=0.731`, 6 citations, bracketed cite present.
- Refusal ("Does the policy cover injuries to a guest in my home?") →
  `refused=true`, answer = exact refusal string, `citations=[]`.
- Live app untouched: `pnpm --filter web eval` still **17/20, 0 SEVERE**.

**The signal in the refusal result:** the refusal question scored
`top_similarity=0.525` — *above* the 0.35 retrieval gate — yet still refused.
That proves the refusal came from the **grounding layer** (Claude declining
because flood-coverage chunks don't answer a liability question), not from the
similarity gate. The Act One "similarity ≠ relevance" behavior reproduced
faithfully in the Python port on the first run. A gate-only refusal
implementation would have (wrongly) tried to answer at 0.525.

**Interview talking point:** "I ported the answerer to a separate Python
service and proved fidelity behaviorally, not by inspection: the two-layer
refusal held — a 0.525-similarity liability question still refused because the
grounding layer, not the similarity gate, caught it. The eval scored identically
on the untouched TS path, so I know the port didn't drift."

**Scope kept out (later blocks):** no Langfuse/tracing, no TS type codegen, no
web→ai wiring, no Render deploy yet.

---

### Block 0.3 ✅ — Typed contract + drift guard

**What it does:** The Python endpoint's Pydantic models are now the single
source of truth for the AI↔web contract, and the TypeScript types are
**generated** from them (not hand-written), with a guard that fails when they
fall out of sync. Pure plumbing — no behavior, prompt, or SQL change.

**Flow:** `apps/ai/scripts/dump_openapi.py` (dummy env, no secrets,
deterministic) writes `openapi.json` → `@claimdesk/types` `gen:types` runs
`openapi-typescript` → `src/api.ts` → `src/index.ts` re-exports friendly names
(`PolicyQARequest` / `PolicyQAResponse` / `PolicyCitation`) → builds to `dist/`
with `.d.ts`. Root `pnpm check:types` regenerates and `git diff --exit-code`s
the two generated files. `apps/web/lib/ai/client.ts` has a typed
`askPolicyQuestion()` using `@claimdesk/types` — the seam for a later wire-in,
not yet called from any route.

**Acceptance (all pass):**
- `pnpm gen:types` writes `openapi.json` + `src/api.ts`.
- `@claimdesk/types` build exit 0; `apps/web` typecheck exit 0 (web consumes the
  shared types).
- `pnpm check:types` passes clean.
- **Tripwire proven:** adding a dummy field to `PolicyQAResponse` made
  `check:types` fail with "Contract types are stale…" (exit 1); reverted.
- `pnpm --filter web eval` still **17/20, 0 SEVERE**; live path untouched.

**Carried issue (for the CI block):** `gen:types` currently invokes the
`apps/ai/.venv` Python via a **Windows-specific Node wrapper**. CI runs on Linux,
so the invocation must be made cross-platform before `check:types` can run in
CI. Noted for Block 0.6.

**Interview talking point:** "The web/AI contract is generated from the Python
service's OpenAPI, not maintained by hand, and a CI drift guard rejects any
commit where the two diverge — I demoed it by adding a field and watching the
check go red."

---

### Block 0.4 ✅ — Langfuse tracing (the "flight recorder")

**What it does:** Each `POST /qa/answer` now emits one Langfuse trace showing the
pipeline end-to-end — retrieval (chunk count + top similarity) and the Claude
call (model + token usage → cost). Instrumentation is **optional and fail-open**:
no keys, or any Langfuse error, and the endpoint answers exactly as before. This
satisfies the Phase 0 "one traced endpoint" DoD item.

**Implementation:** Langfuse Python SDK **v4** (OTEL-based; note the v4 rewrite
landed March 2026, so its API differs from v2/v3 tutorials online). `langfuse
>=4.0.0` added; optional `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` /
`LANGFUSE_HOST` in `config.py` + `.env.example`. `app/observability.py` inits the
client, uses `propagate_attributes(user_id=…)` + `start_as_current_observation`
for the trace/retriever/generation spans, wraps everything fail-open, and flushes
on shutdown + after each request. Trace shape: `policy_qa` → `retrieval`
(retriever) → `claude_answer` (generation with `input_tokens`/`output_tokens`).
Project region: **US** (`us.cloud.langfuse.com`).

**Acceptance (all pass):**
- With keys: answerable Q → `refused=false`, sim 0.731, 6 citations; a `policy_qa`
  trace was produced with the retrieval span and the Claude generation
  (token-counted). Trace visible only in the owner's Langfuse account.
- Fail-open: keys cleared + restart → refusal Q still returns the exact refusal
  string, HTTP 200, no crash.
- Live TS path untouched: `pnpm --filter web eval` still **17/20, 0 SEVERE**.

**Note:** the Langfuse dashboard is private to the account owner — traces can't be
verified by anyone without login; the trace structure reported by the client is
the machine-side confirmation.

**Interview talking point:** "Observability is fail-open by design — tracing is
wrapped so a Langfuse outage or missing key can never add latency or break an
answer, the opposite of the fail-closed rate limiter. Each answer traces as
retrieval → generation with per-call token cost."

---

### Block 0.5 — Multi-tenancy (sub-stepped; the big one)

#### 0.5a ✅ — Org foundation (additive; no cutover)

**What it does:** Migration `006_org_foundation.sql` adds the multi-tenant
*structure* without rewiring anything: `organizations`, `memberships`
(role enum owner/admin/member), `audit_log`, plus membership helper functions,
RLS on the new tables only, and a backfill that creates one default org and
enrolls every existing user. Existing tables, policies, demo mode, `is_demo()`,
`match_chunks`, `reset_demo`, and storage are all **untouched** — zero risk to
the live single-tenant path.

**Recursion trap handled:** `user_org_ids()` / `is_org_member()` /
`current_org_role()` are `SECURITY DEFINER` so they read `memberships` bypassing
RLS. That lets the `memberships` SELECT policy (`user_id = auth.uid() OR org_id in
(select user_org_ids())`) reference the helper without the classic
policy-calls-lookup-calls-policy infinite recursion. (`current_org_role` is
named to avoid clashing with the `org_role` enum type.)

**Acceptance (verified):**
- Default org present; `memberships` backfilled with exactly one `owner` (the
  original seed-creator account) and the rest `member`.
- **Recursion check via in-transaction impersonation** (`set local role
  authenticated` + `request.jwt.claims`): reading `memberships` returned the
  co-member rows, no recursion error — the correct RLS test discipline from Act
  Two, not the SQL-editor false-positive.
- Additive-only ⇒ the TS eval path is structurally unaffected (17/20 holds).

**Interview talking point:** "The multi-tenant rollout was staged — I added org
tables and membership helpers first, additive and reversible, and proved the
RLS recursion trap was avoided by impersonating a role in-transaction rather
than trusting the SQL editor, which runs as owner and bypasses RLS."

---

#### 0.5c ✅ — RLS cutover to org-scoped (the hardest block)

**What it does:** Migration `008_rls_cutover.sql` flips `cases`/`documents`/
`chunks`/`letters` from single-tenant (`created_by = auth.uid()`) to org-scoped
(`org_id in (select user_org_ids())`), sets `org_id NOT NULL`, and splits the
demo user into its **own isolated `demo` org** (re-stamping its rows and updating
`reset_demo()` to keep future resets inside the demo org). `created_by` survives
as an attribution field, enforced on INSERT (`created_by = auth.uid()`) so
authorship can't be forged. Demo read-only restrictive policies (004),
`deadline_rules`, `match_chunks`, and storage policies are untouched.

**Why the demo got its own org:** 0.5b had stamped both the owner's F-122 and the
demo's copy into the default org; under org-scoping that would surface duplicate
policy docs (the "which copy did I operate on" failure mode) and break the eval's
`resolveDocumentId`. Isolating the demo gives the default org exactly one policy
doc AND yields two provably-separate tenants — a stronger artifact.

**Acceptance (verified with a REAL authenticated client):**
- Data partition (direct): `default → 5 cases`, `demo → 5 cases`.
- Signed in as the owner (real password login, so RLS truly applies):
  **5 cases visible, 1 org, 0 demo rows visible** — cross-tenant isolation proven.
- `pnpm --filter web eval` → **17/20, 0 SEVERE**: the AI pipeline works unchanged
  under org-scoped RLS.

**Testing lesson (important):** the Supabase SQL editor's `set local role
authenticated` + `request.jwt.claims` impersonation returned **false zeros** —
`auth.uid()` wasn't populated, so every impersonated query saw nothing. The SQL
editor is untrustworthy for RLS both ways (bypasses as admin → false positives;
mis-impersonates → false negatives). The only reliable RLS test is a real signed-in
client. Isolation was ultimately proven that way.

**Interview talking point:** "I cut a live single-tenant app over to org-scoped
RLS without breaking the AI eval (17/20 before and after). I proved tenant
isolation with a real authenticated session after the SQL editor gave false
negatives — it doesn't populate auth.uid() under impersonation — and I isolated
the demo into its own org to avoid duplicate-document ambiguity in retrieval."

---

#### 0.5d-i ✅ — RBAC + automatic audit logging

**What it does:** Migration `009_rbac_audit.sql` adds owner/admin-gated write
policies on `memberships` and `organizations` (via `current_org_role()`), a
`create_organization()` bootstrap function (creates org + owner membership
atomically, solving the first-member chicken-and-egg), a last-owner-protection
trigger, and automatic audit-log triggers on membership/org changes (SECURITY
DEFINER, so logging can't be bypassed). Additive — data-table access is
unchanged.

**Acceptance (real signed-in client):** `create_organization()` returned a new
org id (RBAC bootstrap); the membership insert auto-wrote a `member.added` row to
`audit_log` (trigger fired); deleting the sole owner was blocked with "Cannot
remove the last owner of an organization". Eval untouched (no data-table policy
changes).

**Finding (caught by a follow-up reconciliation query):** the test's org-cleanup
step **silently no-op'd** — `organizations` has RLS enabled but no DELETE policy,
so an owner's `delete` matched zero rows and returned no error (a silent RLS
no-op). The throwaway `rbac-test-xyz` org was left behind and removed manually as
admin. Decision: no client-side org DELETE for now (safe default — prevents
accidental org deletion); org deletion, if ever needed, becomes a guarded,
audited action later. Lesson: a `delete` that "succeeds" with zero rows under RLS
is indistinguishable from success — verify affected-row counts.

**Follow-on fixes (010, 011) — cascade-delete ordering:** cleaning up the
throwaway org surfaced two triggers that didn't tolerate org teardown.
`010_fix_last_owner_guard.sql`: the last-owner guard blocked the cascade removal
of an org's sole owner during org deletion — refined to block only when removing
the owner would orphan *other remaining members* (teardown / sole-member
departure now allowed). `011_fix_audit_on_teardown.sql`: the audit trigger tried
to log `member.removed` against the already-deleted org, violating
`audit_log_org_id_fkey` — now skips the removal-audit when the parent org no
longer exists. Lesson: trigger logic on a cascade path must account for the
parent row already being gone. The throwaway org then deleted cleanly, leaving
exactly the two real tenants.

**Interview talking point:** "Org administration is role-gated and every
privileged mutation is audit-logged by a database trigger rather than
application code, so the trail can't be forgotten or bypassed; a last-owner
guard prevents orgs from being orphaned."

---

#### 0.5d-ii ✅ — MFA (opt-in TOTP, app-enforced)

**What it does:** Supabase TOTP MFA in `apps/web`, opt-in and non-breaking. A
`/settings/security` page enrolls an authenticator factor (QR + secret, verify a
6-digit code, list/remove factors); an `/mfa` page challenges at login when a
verified factor exists; `updateSession()` in the middleware enforces it —
`aal1→aal2` users are routed to `/mfa`, users with no factor pass through
unchanged. Enforcement is **app-level only**: no DB-level AAL2 requirement, so
the eval and demo accounts (no factor, password-only → aal1) are unaffected.

**Why it doesn't break the eval:** `signInWithPassword` returns an `aal1` session
even for MFA-enrolled users; the challenge is a separate app-enforced step. RLS
is org-membership-based (not aal-based), so authenticated scripts still work. The
owner enrolling MFA does not lock out the eval.

**Acceptance (real + automated):** enroll → verified factor; re-login routes to
`/mfa` and requires a code before `/cases`; demo/no-factor goes straight to
`/cases`; middleware redirects verified via a temporary demo-factor probe
(307 to `/mfa` on protected routes, `/mfa`→`/cases` when satisfied). Eval
**17/20, 0 SEVERE**. Deployed live (apps/web on Vercel); production Supabase was
already migrated, so the live site is multi-tenant + MFA-capable immediately.

**Interview talking point:** "MFA is enforced in the app layer, not the database,
which is a deliberate boundary: it protects interactive sessions without breaking
service-account/eval logins that authenticate by password and operate under
org-scoped RLS."

---

### Block 0.6 ✅ — Quality gates + full deploy (Phase 0 close-out)

#### 0.6a ✅ — CI

**What it does:** GitHub Actions on every push. `checks` job: lint + typecheck +
unit tests + `check:types` drift guard across both apps (carried lint error
fixed; `gen:types` made cross-platform so it runs on Linux CI, not just the
Windows venv wrapper). `eval-gate` job: **path-filtered** — runs the eval
(`EVAL_CI=1`, exit 1 on SEVERE>0 or PASS<17) only when a change touches the AI
retrieval/prompt paths (`lib/qa`, `lib/tree`, `retrieval-config`, `eval`,
`apps/ai/app`), plus manual `workflow_dispatch`. Eval secrets live in GitHub
Actions secrets.

**Acceptance:** first run green — `checks` ✅, `eval-paths` ✅, `eval-gate`
correctly **skipped** (push didn't touch AI paths). The gate is real: it will run
and can fail the build on a SEVERE/regression when AI code changes. Note: the
owner account has MFA enrolled, and the eval still passes because
`signInWithPassword` returns an aal1 session and RLS is org-based, not aal-based.

#### 0.6b ✅ — `apps/ai` live on Render

**What it does:** Dockerized `apps/ai` (python:3.12-slim, uvicorn on `$PORT`),
`.dockerignore`, root `render.yaml` blueprint (`healthCheckPath: /health`,
secrets as `sync:false`), and CORS via optional `WEB_ORIGIN` (defaults `*`,
Phase 1 will lock to the web domain). Deployed to Render.

**Acceptance:** build + deploy succeeded; `Application startup complete`;
`https://claimdesk-<id>.onrender.com/health` → `{"status":"ok"}`. Gotcha logged:
the bare root URL 404s (no `/` route — only `/health` and `/qa/answer`), and
Render's default probe hits `/`; fix is setting the service Health Check Path to
`/health`. The live web app does not call this service yet (Phase 1 cutover).

**PHASE 0 COMPLETE** — monorepo, Python AI service (traced, live), typed
contract, multi-tenant RLS + RBAC + MFA + audit, CI with a real eval gate.

---

## Phase 1 — Case spine + policy intelligence

### Block 1.1 ✅ — Matter/case spine (org-scoped create + edit UI)

**What it does:** Added the missing create/edit surface for matters. Until now a
matter (`cases` row) could only exist via the seed — the product had no way to
open a new case. Block 1.1 adds a `/cases/new` intake route and a
`/cases/[id]/edit` route, both rendering one shared, typed `<MatterForm>`
(`app/cases/matter-form.tsx`) that drives create *and* edit from the same field
set. Two validated server actions (`createMatter` / `updateMatter` in
`app/cases/actions.ts`) parse + validate the form through a single
`parseMatterForm()` and write via the org-scoped client. The list page gains a
"New matter" CTA (and a first-run empty-state button); the detail page gains an
"Edit matter" link. **No SQL, nothing on the AI path.**

**Design decision — extend, don't rename.** Kept the `cases` table and `/cases`
routes; "matter" is product vocabulary layered on top. A rename to `matters`
would ripple through every query, the hand-written `types/database.ts`, all four
tables' RLS, `reset_demo()`, storage paths, and the eval's `resolveDocumentId`
for zero functional gain — exactly the big-bang churn the strangler-fig locked
decision exists to avoid. Kept the block **SQL-free**: the 12 existing intake
columns already form a complete intake, so no speculative columns were added.
Extensibility comes from the shared form + single validator, not spare columns.

**Why no migration was needed:** org-scoped CRUD on `cases` was already enforced
at the DB layer by the 0.5c cutover (008) — select/insert/update/delete on
`org_id in (select user_org_ids())`, with insert also requiring
`created_by = auth.uid()`. `org_id` defaults to `default_org_id()` and
`created_by` to `auth.uid()`, so a plain insert of the intake fields auto-stamps
the caller's org and authorship; the app never passes `org_id`. This block just
exposed in the UI what the database already permitted.

**Demo-safe at four layers:** hidden CTA (list/detail render no create/edit
buttons for `is_demo`) → route guard (`/cases/new` and `/cases/[id]/edit`
redirect the demo user away) → action guard (`isDemoUser` returns a friendly
"disabled in the public demo" error) → DB (the 004 restrictive policies block the
insert regardless). Belt-and-suspenders.

**Acceptance (all verified by the user, local + live):**
- Create as owner → redirected to `/cases/<new-id>`, matter appears at the top of
  the list with correct fields.
- Validation: empty title + 1-char state → inline field errors, no row created.
- Edit persists (status + amounts round-trip through the detail view).
- Org stamping: the new row carries the default `org_id` and the owner's
  `created_by` (column defaults; org-scoped RLS enforced) — confirmed in the
  Table Editor (reading a value, not testing RLS enforcement).
- Demo: no create/edit affordances; `/cases/new` bounces demo back to `/cases`.
- Gates green: `lint`, `typecheck`, `build`. Deployed to Vercel; GitHub Actions
  `checks` green and `eval-gate` **correctly skipped** (no AI-path files changed).
- Trust baseline (17/20, 0 SEVERE) structurally untouched — this block edits no
  retrieval/prompt/eval code, so the gate has nothing to run.

**Findings / notes:**
- `/cases/new` is a static segment and resolves ahead of the `[id]` dynamic
  segment (Next prefers exact matches), so there's no "case not found" collision.
- Local dev points at **production** Supabase via `apps/web/.env.local`, so test
  matters are real rows in the `default` org; removed via the Table Editor after
  testing. There is no in-app matter delete yet (intentionally deferred).
- A `<Link-back />` placeholder typo in the first draft of `new/page.tsx` was
  corrected to a real back link before applying.

**Extensibility recipe (logged for future intake fields):** to add a field later —
(1) additive **nullable** column in a new migration; (2) add it to `Case` and the
`cases` Insert/Update in `types/database.ts`; (3) add one getter + validation in
`parseMatterForm()` and one field block in `matter-form.tsx`. No RLS or eval
impact; no cutover.

**Interview talking point:** "The matter spine was a UI-layer-only block: the
database already enforced org-scoped CRUD from the multi-tenant cutover, so I
exposed create and edit through one shared, validated form and kept it entirely
SQL-free. I deliberately extended `cases` rather than renaming to `matters` — a
rename would have rippled through RLS, the demo reset, and the eval's document
resolver for no functional gain, which is exactly the big-bang churn the
strangler-fig approach exists to avoid. Demo stays read-only at four independent
layers, the outermost being a database restrictive policy."

### Block 1.2a ✅ — Storage org-scoping (case-documents bucket)

**What it does:** Cut the `case-documents` bucket from owner-only (001) to
org-scoped, mirroring the `008` data-table cutover. New path convention
`${org_id}/${case_id}/${filename}`; migration `012` drops the three owner-only
policies and creates four org-scoped ones (select/insert/update/delete) gated on
`((storage.foldername(name))[1])::uuid in (select user_org_ids())`.
`uploadDocument` now derives the prefix from the case's `org_id`. The `004` demo
restrictive storage block is left intact and ANDs on top.

**Migration of existing objects — the right tools for two jobs.** A one-time
**service-role** script (`scripts/migrate-storage-paths.ts`) relocated the legacy
objects to org paths, preserving `document_id` / chunks / embeddings so the eval
can't move — chosen over re-upload precisely to avoid the duplicate-document
ambiguity the kickoff brief warns about. Physical byte-move goes through the
service role (an admin migration; RLS can't move bytes); RLS **enforcement** was
proven separately with a real signed-in client (`scripts/prove-storage-rls.ts`),
per the "SQL editor is untrustworthy for RLS" rule.

**Acceptance (verified):** migration applied; the real-client proof printed
`A) read own-org object OK` and `B) write into another org prefix DENIED`; new
uploads land at `${org}/${case}/…` and ingest to `ready`; demo still blocked
(004); `lint`/`typecheck`/`build` green; deployed; `eval-gate` skipped (off AI
path). Eval **17/20, 0 SEVERE** — retrieval is untouched because resolution
ignores `storage_path` and the move preserved chunks/embeddings.

### Block 1.2a-ii ✅ — Data reconciliation (surfaced by the migration)

**What the move surfaced:** the script processed **4 document rows backed by only
2 physical files** — 2 in the default org, 2 `reset_demo()` clones in the demo org
(reset_demo copies `storage_path` verbatim). Two "moves" failed harmlessly
(`Object not found`) because the demo clones referenced files the default docs had
already relocated. **No bytes lost** (the failures were no-ops). A storage
migration doubled as a consistency probe — latent duplication invisible through
the app.

**Corrected facts (the kickoff brief was stale on these):**
- **default org = `60b4efce-8f8a-4298-8df6-3bcd8d934cb8`**
- **demo org = `27510487-9e3f-4c34-8176-9d68893f6677`**
- The brief's `507e369b-a842-40ff-aeda-05c66a30b8bb` is the **owner USER id** (the
  old `${user_id}/…` storage prefix), *not* the default org id.
- The brief's `d110bfd1-41f2-46e6-acd8-425286585b01` is a **stale demo-org id**.
- There is exactly **one real document** (FEMA F-122); every other `documents` row
  is a replica of it (2 in default, 2 demo clones).

**Resolution:** (1) `select reset_demo();` re-clones the demo docs against the live
default paths, clearing the inert stale-path state (demo never reads storage and
it self-heals on reset regardless). (2) **Pinned the eval in CI** — added
`DOC_ID: ${{ secrets.DOC_ID }}` to the `eval-gate` env in `.github/workflows/ci.yml`
plus a `DOC_ID` GitHub Actions secret — so CI resolves the same fixed document as
local instead of the "most-recent ready policy doc" fallback (which passed only
because the two default docs are identical replicas). This honors the "pin DOC_ID
/ one policy doc in default org" invariant. (Both are trivial one-liners; apply if
not already done — neither blocks later blocks.)

**Interview talking point:** "Org-scoping the storage bucket doubled as a data
audit: moving the physical objects surfaced that four document rows were backed by
two files across two orgs, plus a couple of scaffolding IDs in my own brief that
were stale. I fixed the data, corrected the docs so nothing downstream builds on
bad assumptions, and hardened CI to pin the eval's document. The discipline that
made it safe was separating the admin byte-move (service role) from the RLS
enforcement proof (a real authenticated client)."

### Block 1.3a ✅ — Multi-doc retrieval (backend)

**What it does:** Matter-scoped Q&A. Migration `013` adds `match_chunks_multi`,
mirroring `match_chunks` but taking a `uuid[]` of document ids and returning
`document_id` per row (SECURITY INVOKER, so chunks RLS still applies). A new,
additive `answerMatterQuestion(caseId, question)` in `lib/qa/pipeline.ts` gathers
the matter's *ready* documents (RLS-scoped), retrieves across them, applies the
**same** 0.35 similarity gate and refusal contract, and tags each citation with
its source document. New `askMatter(caseId, question)` server action. The
single-document path (`answerPolicyQuestion`, `match_chunks`, the QA prompt,
`retrieval-config`) is byte-identical — the eval path is frozen.

**Acceptance:** both RPCs present; `lint`/`typecheck`/`build` green; eval
**17/20, 0 SEVERE**.

**Finding — the eval-gate runs on PR/dispatch, not on direct push.** The
`eval-gate` job's `if` only fires on `pull_request` (path-matched) or
`workflow_dispatch`, so a plain `git push` to main was skipping it silently
(caught when a push showed "eval-gate skipped"). Rather than widen the trigger to
`push`, **adopted a PR-based workflow** (branch → PR → gate runs → merge) — which
is what the gate was built for. 1.3a's 17/20 was confirmed via a manual
`workflow_dispatch`; from 1.3b on, every AI-path change goes through a PR so the
gate runs automatically. (Optional next step: mark `eval-gate` a *required* check
via branch protection so a red eval actually blocks merge.)

**Interview talking point:** "Multi-document retrieval went in as a parallel
function, not a rewrite of the existing one — the eval's single-doc path stays
frozen, so the 17/20 trust baseline literally can't move while the product grows
around it. Strangler-fig at the function level."

### Block 1.3b ✅ — Citation verifier

**What it does:** A pure `verifyCitations(answer, retrievedChunks)`
(`lib/qa/verify.ts`). It parses every `[LABEL, p.PAGE]` marker, resolves it
against the passages **actually retrieved and shown to the model** (Roman
section-prefix match — the same label semantics as `eval/scoring.ts` — plus page
overlap), classifies each **verified / unverified**, and returns per-citation
source text + a summary (`verifiedCount` / `totalCount` / `allVerified`). Wired
into `answerMatterQuestion` only. 7 `node:test` unit tests added; the `test`
script now includes them.

**Key property:** it verifies against *retrieved* passages, a strict subset of
the eval's whole-document invented-citation check — so **verified ⊆ eval-valid**.
A green check in the product means source text ClaimDesk can display, and it can
never contradict the CI gate.

**Acceptance:** 12/12 tests pass; `lint`/`typecheck`/`build` clean; PR
`eval-gate` **17/20, 0 SEVERE**; single-doc/eval path unchanged. Shipped through
the first real PR → merge flow.

**Interview talking point:** "The product's citation check reuses the eval's
section semantics, so the trust signal a user sees is the same contract CI
enforces — and it's stricter, because it verifies against the passages actually
retrieved, not just any section in the document."

### Block 1.3c ✅ — § tabs + verified-citation UI

**What it does:** Replaces the one-panel-per-document setup with a single
matter-wide **"Ask the matter"** panel (`matter-qa-panel.tsx`) that calls
`askMatter`. Each answer renders inline citation chips — green `§` chips for
**verified** citations (click to view the exact source), amber ⚠ chips for
**unverified** — a trust bar (`N/M citations verified against source`), and a row
of **§ tabs**, one per cited section, each revealing that citation's verified
source passage (with the source document's title when the matter spans several
docs). Refusals show the refusal string + "refused rather than guessing." The
detail page renders one `MatterQAPanel` whenever there's ≥1 ready document.

**Acceptance:** `lint`/`typecheck`/`build` green; per-document panels replaced;
verified/unverified chips + trust bar + § tabs all function; refusal path intact;
`eval-gate` correctly **skipped** (UI only). Merged via PR.

**This closes the Phase 1 demoable target:** create a matter → upload a policy →
ask it questions → get verified citations.

**Interview talking point:** "The trust surface makes the model's grounding
inspectable: every citation in an answer is either a green, click-to-verify
source passage or an amber 'couldn't verify' flag — backed by the same
server-side verifier the unit tests cover, which is itself stricter than the CI
eval's citation contract."

### Block 1.4a ✅ — Eval cutover to the Python endpoint (parity proof)

**What it does:** Added an opt-in `QA_TARGET=remote` mode to the eval runner
(`eval/run-eval.ts` only). Default (`local`) still calls the in-process TS
pipeline, byte-identical; `remote` calls `apps/ai` `POST /qa/answer` via
`lib/ai/client.ts`, forwarding the eval user's Supabase JWT so the Python service
builds a **user-scoped, RLS-applying** client. Maps the snake_case response back
to the eval's shape.

**Acceptance:** local eval unchanged; remote (against the live Render service)
**17/20, 0 SEVERE**, refusal Q20 held — the parity proof that the Python port is
behavior-identical (same 3 FAILs Q4/Q13/Q18, SEVERE=0).

**Interview talking point:** "The strangler-fig proof: the same golden eval that
gates the trust core now runs against the Python service, so any behavior drift in
the port fails CI rather than shipping silently."

### Block 1.4b ✅ — CI gates the Python service + CORS lock

**What it does:** Pointed the CI `eval-gate` at the endpoint (`QA_TARGET=remote` +
`AI_BASE_URL` secret) with a Render cold-start **warm-up** step (a `curl /health`
retry loop) before the eval runs. Locked `apps/ai` CORS: `WEB_ORIGIN` set to the
web domain on Render (server-to-server / CI calls are unaffected — CORS is
browser-enforced only).

**Acceptance:** manual `workflow_dispatch` → warm-up reports "AI service is up" →
eval **17/20, 0 SEVERE**, now sourced from `apps/ai` inside CI; `/health` still
`ok` after the `WEB_ORIGIN` change. `ci.yml` isn't in the eval path-filter, so the
ci.yml PR itself skipped the gate — validated via manual dispatch (per the 1.3a
finding).

**Interview talking point:** "CI now gates the deployed Python service end to end —
forwarded JWT → RLS → retrieval → Claude — not just in-process TS. The single-doc
TS pipeline is now effectively a reference implementation; the eval's source of
truth moved across the service boundary without the app going dark."

### Block 1.5 ✅ — Review-queue skeleton (human-in-the-loop)

**What it does:** A generic `review_items` table (migration `014`) — `kind`
(`qa_answer` | `letter` | `coverage_analysis`) + optional `ref_id`/snapshot,
org-scoped RLS (mirrors `008`), demo read-only (mirrors `004`), indexed on
`(org_id, status, created_at)`. Server actions `flagForReview` / `setReviewStatus`
(org_id + created_by auto-stamp; demo-guarded). A **"Flag for review"** affordance
on each matter Q&A answer captures the question + answer + **verification summary**
as a snapshot. A `/review` queue page (Awaiting review / Reviewed) with
Approve/Reject. Header **Review** link with a pending count; `/review` added to
protected middleware routes.

**Acceptance:** migration + 7 policies live; `lint`/`typecheck`/`build` clean;
owner can flag → item appears in `/review` with its `[N/M citations verified]` tag
+ "View matter" link → Approve/Reject moves it to Reviewed and updates the header
count; demo has no flag button and `/review` is view-only (empty). `eval-gate`
correctly skipped. Merged via PR.

**Interview talking point:** "The queue is deliberately generic — letters,
coverage analyses, or auto-flagged low-confidence answers all enqueue through the
same insert — and each Q&A snapshot carries its verification status, so a reviewer
sees the trust signal at a glance. It's the human-in-the-loop surface the trust
product needs."

---

## Act Three timeline log

- **Block 0.1 ✅** monorepo skeleton — Turborepo + pnpm; app lifted into
  `apps/web` unchanged; `apps/ai` FastAPI `/health` stub; `packages/{ui,types,
  config}` placeholders; eval 17/20 / 0 SEVERE confirms clean lift. Carried
  issues: pre-existing lint error, pnpm/corepack path, Vercel root dir.
- **Block 0.2 ✅** first Python endpoint — `POST /qa/answer` behavior-identical
  port; answerable cited (sim 0.731), refusal held at sim 0.525 via grounding
  layer; live app untouched at 17/20 / 0 SEVERE.
- **Block 0.3 ✅** typed contract — TS types generated from the Python OpenAPI
  into `@claimdesk/types`; `check:types` drift guard proven (tripwire went red);
  web typecheck green; eval 17/20 / 0 SEVERE. Carried: cross-platform gen:types
  for CI.
- **Block 0.4 ⏳** Langfuse tracing on the endpoint ("one traced endpoint" DoD) —
  requires a free Langfuse account (2 keys). Small, next.
- **Block 0.4 ✅** Langfuse v4 tracing — optional, fail-open; `policy_qa` →
  `retrieval` → `claude_answer` (token-counted); US region; eval 17/20 / 0 SEVERE.
  "One traced endpoint" DoD met.
- **Block 0.5 ⏳ (sub-stepped)** multi-tenancy — the big one, done in pieces:
  - **0.5a ✅** org foundation — organizations / memberships / audit_log +
    helpers + backfill; additive, no cutover; recursion trap avoided
    (impersonation-verified).
  - **0.5b ⏳** add `org_id` to cases/documents/chunks/letters + backfill from
    each row's creator → default org (still keep old RLS live).
  - **0.5c ✅** RLS cutover — org-scoped policies on all four tables; demo split
    into its own isolated org; `org_id NOT NULL`; proven with a real login
    (owner sees 5 cases / 1 org / 0 demo rows); eval 17/20 / 0 SEVERE.
  - **0.5d-i ✅** RBAC + audit — owner/admin-gated member/org management,
    `create_organization()` bootstrap, last-owner guard, auto audit triggers.
  - **0.5d-ii ⏳** MFA (two-factor login) enrollment + enforcement in apps/web.
  - **0.5d-ii ✅** MFA — opt-in TOTP, app-enforced via middleware AAL check;
    non-breaking (eval/demo unaffected); deployed live. **Block 0.5 COMPLETE.**
- **Block 0.6 ⏳ (final Phase 0)** quality gates + full deploy:
  - **0.6a ✅** CI — checks (lint/typecheck/test/drift) + path-filtered eval gate
    (fails on SEVERE/regression); lint error fixed; gen:types cross-platform.
  - **0.6b ✅** `apps/ai` live on Render (Docker); `/health` → ok. **PHASE 0
    COMPLETE.**
- **Block 1.1 ✅ (Phase 1 opens)** matter/case spine — `/cases/new` +
  `/cases/[id]/edit`, one shared typed `MatterForm` (create+edit), validated
  `createMatter`/`updateMatter` actions, list/detail CTAs. **SQL-free**:
  org-scoped CRUD already live from 008 (org_id/created_by defaults + RLS). Demo
  read-only at four layers. lint/typecheck/build green; deployed; eval-gate
  skipped (off AI path), 17/20 baseline structurally untouched. Chose
  extend-not-rename (`cases` stays; "matter" is UI vocabulary).
- **Block 1.2a ✅** storage org-scoped (migration `012`) — `case-documents` cut
  from owner-only to org-scoped by path prefix `${org}/${case}/${file}`;
  `uploadDocument` derives the prefix from the case org; legacy objects relocated
  by a service-role script preserving `document_id`/chunks (eval-safe); isolation
  proven with a real signed-in client. Demo block intact; 17/20 held.
- **Block 1.2a-ii ✅** reconciliation — the move surfaced 4 doc rows / 2 files / 2
  orgs. Corrected stale IDs: default = `60b4efce…`, demo = `27510487…`
  (brief's `507e369b…` = owner uid; `d110bfd1…` = old demo). One real F-122, rest
  replicas. Refreshed demo (`reset_demo`) + pinned `DOC_ID` in CI (secret +
  `ci.yml` env).
- **Block 1.3a ✅** multi-doc retrieval — `match_chunks_multi` (013) + additive
  `answerMatterQuestion` + `askMatter`; single-doc/eval path frozen; 17/20 (via
  dispatch). Found: eval-gate runs on PR/dispatch, not push → adopted PR workflow.
- **Block 1.3b ✅** citation verifier — pure `verifyCitations` (label-prefix +
  page overlap, eval-aligned) wired into the matter path; 7 unit tests;
  verified ⊆ eval-valid; 17/20 held; merged via PR.
- **Block 1.3c ✅** § tabs + verified-citation UI — matter-wide QA panel replacing
  per-doc panels; inline verified(green)/unverified(amber) chips + trust bar +
  per-section source tabs; refusal intact; UI-only (eval-gate skipped); merged.
  **Phase 1 demoable target met.**
- **Block 1.4a ✅** eval → Python cutover — opt-in `QA_TARGET=remote` hits
  `apps/ai` `/qa/answer` with forwarded JWT; local path unchanged; remote parity
  **17/20, 0 SEVERE**, refusal held.
- **Block 1.4b ✅** CI gates Python + CORS lock — `eval-gate` set
  `QA_TARGET=remote` + `AI_BASE_URL` with a Render warm-up; `WEB_ORIGIN` locked to
  the web domain; dispatch → 17/20 from `apps/ai`; `/health` ok.
- **Block 1.5 ✅** review-queue skeleton — generic `review_items` (014, org RLS +
  demo RO), `flagForReview`/`setReviewStatus`, "Flag for review" on Q&A answers
  (verification snapshot), `/review` queue with approve/reject, header count.
  eval-gate skipped; merged.

**PHASE 1 (focused sprint) — BLOCKS 1.1–1.5 COMPLETE.** Case spine, org-scoped
storage, multi-doc policy Q&A with a citation verifier + § tabs, the QA eval cut
over to the Python service (CI-gated) with CORS locked, and a human-in-the-loop
review queue.

**Housekeeping (C) — DONE:** `DOC_ID` added as a GitHub Actions secret (CI eval
resolves the same fixed document as local); `select reset_demo();` run and
verified (no legacy `507e369b-…` storage paths remain; demo re-seeded; both orgs'
docs now prefix the default org id — expected, since reset_demo copies the source
`storage_path` and demo never reads storage).

**Deferred to Phase 2 (by decision):**
- **1.2c** — LLM structure extraction for non-NFIP documents (belongs in
  `apps/ai`; needs a fictional "hard" specimen to test; F-122 path stays untouched
  so the eval can't move).
- **Multi-doc product QA → `apps/ai`** — the *eval* (single-doc) is cut over and
  CI-gates the Python service, but the live product's multi-doc "Ask the matter"
  still runs its AI logic in the Next.js server. Completing the strangler-fig means
  a Python `/qa/matter` endpoint (cross-doc retrieval + ported verifier) with the
  web panel calling it (JWT forwarded). Most pieces already exist in `apps/ai`
  (embeddings, Claude, gate, `match_chunks_multi` RPC); the verifier is a small
  pure port.
- **(Optional, D)** make `eval-gate` a *required* status check via branch
  protection — needs a small ci.yml change so the gate always reports a status
  (pass-through when no AI-path files change), else it blocks unrelated PRs.

---

## Phase 2 — AI trust core

### Block 2.1 ✅ — Finish the cutover + signup + landing

**What it does:** Closed the split-brain from Phase 1: the live "Ask the
matter" Q&A now calls `apps/ai`'s `POST /qa/matter` (JWT forwarded) instead of
running in the Next.js server, so the eval and the live product finally run
the same Python path. Added public self-serve signup (`/signup`,
`/signup/check-email`) and a marketing/landing page.

**Acceptance:** verified against actual repo state — see
`docs/phase-2-progress.md`.

### Block 2.2a ✅ — Retrieval Lab v2: budgets + multi-doc golden corpus

**What it does:** Content-only sub-step, no retrieval code touched.
`docs/decisions/001-retrieval-benchmark-budgets.md` sets latency (p50 ≤ 8s /
p95 ≤ 12s) and cost (≤ $0.03/query) budgets for the upcoming ablation, grounded
in the measured F-122 baseline. `eval/golden-f123.json` (13 Qs) and
`eval/golden-f144.json` (10 Qs) extend the golden corpus alongside the frozen
`eval/golden.json` (F-122) — not yet ingested or wired into the runner.

### Block 2.2b ✅ — Ingest F-123/F-144 + multi-doc eval runner

**What it does:** `scripts/ingest-golden-docs.ts` (new, idempotent) signs in
as the owner, uploads both PDFs into the same org + fixture case that already
holds the frozen F-122 doc (`Okafor Hail Damage`, org `60b4efce…`), and drives
the existing `processDocumentIngestion()` pipeline unchanged. `eval/run-eval.ts`
gained a `GOLDEN_FILE` env var (default `golden.json`, i.e. zero behavior
change for the frozen path) that, for any other golden file, resolves its
document via a new `eval/documents.json` map (form → document_id) instead of
`DOC_ID` — `resolveDocumentId()` itself was not touched.

**Ingest results:**

| Form | document_id | chunks | pages | labeled_ratio | pages_detected | est. tokens | est. cost |
|---|---|---|---|---|---|---|---|
| F-123 | `0411ce14-03ee-4841-bd7a-058c94af2ffd` | 296 | 27 | 1.000 | 27/27 | 15,959 | $0.00032 |
| F-144 | `2e29b25f-d0bf-4f1c-b956-11cd6a8c0d88` | 306 | 28 | 1.000 | 28/28 | 16,901 | $0.00034 |

Both parsed as cleanly as F-122 (100% section-label ratio, full page
detection) — no page-footer misdetection, no un-labeled stub chunks. Combined
ingest cost ≈ $0.0007, negligible (`text-embedding-3-small`, char/4 estimate
per ADR 001's convention — no real token usage API was called twice to avoid
double billing).

**Golden eval on the new docs (multi-doc corpus, NOT the frozen gate):**
F-123 11/13 PASS, 0 FAIL, 2 SEVERE. F-144 7/10 PASS, 3 FAIL, 0 SEVERE. These
are expected — the corpus is deliberately adversarial (traps, cross-references,
a worked coinsurance example) and this is the *first* uningated look at it
before any retrieval improvements. Spot-checked 3 F-123 and 3 F-144 questions
directly against retrieved chunks + answers (incl. the flagship RCBAP
coinsurance trap, Q4: correctly computed $134,500 citing VII.C.3) — confirmed
answerable, not a data problem.

**Findings (evidence for later blocks, nothing fixed here — retrieval/prompt
logic was not touched per the block's scope):**

1. **The `MIN_CHUNK_CONTENT_CHARS = 50` filter silently drops short lettered
   sub-items.** E.g. in the flood definition (§II.B.1), "a. Overflow of inland
   or tidal waters;" (36 chars) and "c. Mudflow." (8 chars) parse correctly as
   headings but then get discarded for being under the 50-char floor — they
   never become chunks, so their section labels never enter `validSections`.
   This produced F-123's Q12 SEVERE: the model quoted a real cross-reference
   ("...our definition of flood (see II.B.1.c and II.B.2)") verbatim from a
   *different*, longer chunk (V.C.6) that legitimately mentions those labels —
   but since II.B.1.c has no chunk of its own, the eval's citation validator
   flagged it as invented. Not a hallucination; a scoring/chunking-granularity
   false positive. Confirmed by re-running `chunkPolicyText()` (pure function,
   no DB writes) against the F-123 raw text.
2. **The frozen F-122 chunks are not reproducible by today's parser.** Running
   the *current* `chunkPolicyText()` fresh against the F-122 PDF (again, pure
   function — the live F-122 document/DOC_ID was never touched or
   reprocessed) yields 314 chunks and also drops II.B.1.a/II.B.1.c, matching
   F-123/F-144's behavior exactly. But the live F-122 chunks in Supabase
   number 408 and *do* include II.B.1.a/II.B.1.c. The frozen doc's chunks
   predate the current chunker (likely carried over through the Block 1.2a-ii
   storage relocation, which preserved chunk rows rather than re-parsing) —
   the "frozen path" is frozen at the model/prompt/retrieval-param level, but
   its underlying chunk data has quietly drifted from what the current
   pipeline would produce. **Risk flag: do not hit "reprocess" on the F-122
   document** — it would regenerate chunks with today's parser and could
   shift the 17/20 baseline. Worth a dedicated ADR before Block 2.4 if the
   extractor gets rebuilt.
3. **Refusal-contract exactness is inconsistent across documents.** F-123's
   Q13 (pure liability refusal) got SEVERE not because of invented content,
   but because the model's answer was `"I can't find this in the policy."`
   followed by an explanatory paragraph — the scorer requires an *exact*
   string match to `REFUSAL_MESSAGE`, per the CLAUDE.md contract. F-122's
   frozen prompt/doc combination reliably produces the bare string; F-123 does
   not always. Same root symptom (a hedging tail) also showed up, harmlessly,
   on F-123 Q1 and F-144 Q2 (flood-definition questions) — likely downstream
   of finding 1: since the actual a/b/c list is fragmented, the model isn't
   fully confident even when it cites the right section.
4. **3 real retrieval-ranking misses on F-144** (Q1, Q7, Q9 — FAIL, not
   SEVERE): the correct section chunk exists in the corpus (confirmed present
   in `chunks`) but didn't make the top-6 vector-similarity results — e.g. Q9
   expected `V.D.5` (present as `V.D.5.b/.c/.d`) but the top-6 retrieved
   chunks were all near-miss neighbors (III.D.3.e, VIII.Q.1, etc.), none of
   them V.D.5.*. Direct ablation fodder for Block 2.2's hybrid/BM25/reranker
   work — vector-only, single-document retrieval doesn't reliably surface the
   right subsection when several adjacent sections are semantically close.

**Not done in this block (by scope):** embedding/chunking/hybrid/reranker
ablation itself — that's the rest of Block 2.2, and now has three real
findings above to react to going in.

### Block 2.2c ⏳ IN PROGRESS — Retrieval ablation harness (proof-of-harness checkpoint)

**What it does:** Built the reproducible 3-doc benchmark corpus and the
ablation harness itself; ran a small proof (5 questions, 2 configs, real API
calls) to validate the harness before committing to the full sweep, per the
block's checkpoint instruction. Live retrieval/prompt path untouched.

1. **Fresh F-122 copy for the benchmark, live F-122 still frozen.**
   `scripts/ingest-f122-ablation.ts` (new) ingests
   `docs/policy-corpus/fema_F-122-Dwelling-SFIP_2021.pdf` under a new
   document row (`920bb3a7-257f-4a04-ad23-6118ee86ddad`, title suffixed
   `.ablation-2.2c.pdf` so it can never collide with the live doc by title or
   storage path) into the same fixture case as F-123/F-144. Produced 314
   chunks — matching the 2.2b finding exactly (today's parser yields 314,
   not the live doc's 408; confirms the drift finding and that the live
   F-122 document was correctly never touched). `eval/golden-f122-ablation.json`
   mirrors the frozen `golden.json`'s 20 questions under `form:
   "F-122-ABLATION"`. `eval/documents.json` gained a fourth key,
   `F-122-ABLATION`, alongside the untouched `F-122`/`F-123`/`F-144`.
2. **Harness (`eval/retrieval-lab.ts`, `eval/bm25.ts`, new).** Runs the
   3-doc benchmark corpus across retrieval configs, measuring real accuracy,
   latency, and token cost per query — see
   `docs/decisions/002-retrieval-lab-harness-design.md` for the design
   (in-process BM25 + RRF fusion, zero schema changes; dense retrieval in
   every config goes through the real, unmodified `match_chunks_multi` RPC).
   Configs implemented so far: `dense` (faithful reproduction of the live
   single-retriever path) and `hybrid` (dense + BM25 fused). `LAB_SAMPLE`/
   `LAB_CONFIGS`/`LAB_DOCS`/`LAB_TOPK`/`LAB_POOL` env vars support cheap
   partial runs. Output: `eval/retrieval-lab-results.md` (leaderboard +
   per-doc breakdown + full row dump).
3. **Proof run (real API calls, not simulated):** 5 questions sampled
   round-robin across the 3 docs, `dense` vs `hybrid`, topK=6, pool=20.

   | config | n | PASS | FAIL | SEVERE | p50 latency | p95 latency | avg cost/query |
   |---|---|---|---|---|---|---|---|
   | dense | 5 | 4 | 1 | 0 | 5,974ms | 7,456ms | $0.00510 |
   | hybrid | 5 | 5 | 0 | 0 | 3,343ms | 5,122ms | $0.00443 |

   The one FAIL→PASS flip (F-144 Q1) is the exact retrieval-ranking miss
   flagged in 2.2b's finding 4 (expected `V.D.5`, dense-only missed it) — the
   harness reproduced a known failure and hybrid fixed it, on the first real
   question drawn from that finding. n=5 is not a verdict on the config, only
   a harness sanity check. Real measured cost (~$0.0044–0.0051/query) is
   ~40% below ADR 001's estimate (~$0.010–0.014) on this small sample —
   driven by shorter observed generations; not yet enough data to replace
   the ADR 001 budget baseline.

**Checkpoint — stopped here per the block's instruction**, before running
the full sweep. Full-sweep cost projection and remaining scope (top-k knob,
`MIN_CHUNK_CONTENT_CHARS` knob, contextual chunks, reranker) reported to the
human for go-ahead; see chat for the numbers. Reranker specifically needs a
new vendor key (Cohere/Voyage — none currently configured) before it can run
at all, a separate decision from the cost checkpoint.

**Human approved the full dense+hybrid sweep** (43 questions x 2 configs,
projected ~$0.41). Ran it — see `docs/decisions/003-hybrid-retrieval-ablation.md`
for the full analysis.

| config | n | PASS | FAIL | SEVERE | p50 latency | p95 latency | p50 retrieval-only | avg cost/query |
|---|---|---|---|---|---|---|---|---|
| dense | 43 | 32 (74.4%) | 7 | 4 | 6,227ms | 8,701ms | 213ms | $0.00643 |
| hybrid | 43 | 34 (79.1%) | 6 | 3 | 6,178ms | 8,922ms | 204ms | $0.00658 |

Net: +2 PASS / −1 FAIL / −1 SEVERE, at effectively zero added latency
(retrieval-only 213ms→204ms — BM25+RRF fusion is sub-millisecond in-memory
work; the extra step is one `match_chunks_multi` call at a bigger
`match_count`) and inside cost noise (+2.3%, driven by generation-length
variance, not a systematic hybrid tax). Real per-query cost
($0.0064–0.0066) replaces the ADR 001 estimate ($0.010–0.014) — about 40%
lower than estimated, mostly shorter observed generations.

5 of 43 questions changed status: 3 clean wins (F-122-ABL Q13, F-144 Q1,
F-144 Q7 — BM25 keyword recall catching near-miss dense rankings, matching
2.2b's finding-4 prediction exactly), 1 partial win (F-122-ABL Q16, SEVERE
downgraded to FAIL — the invented-citation hallucination stopped, but the
correct passage still wasn't retrieved), 1 regression (F-123 Q8, PASS→FAIL
— BM25 apparently displaced a correct dense top-1).

**All 4 remaining SEVEREs (2 dense-only, 2 shared by both configs) trace to
two root causes already identified in 2.2b, neither fixable by re-ranking:**
the `MIN_CHUNK_CONTENT_CHARS=50` chunk-drop (invented citation `II.B.1.C`,
which literally has no chunk in either config's index) and the
refusal-string-exactness inconsistency (a generation/prompt-adherence issue,
unrelated to retrieval). Confirms those need their own fixes, not more
ranking work.

**ADR 003 — Accepted, with caveat:** hybrid is the base config for the
remaining ablation legs (contextual chunks, reranker) — it earns its keep
at ~zero cost. **Live path (`match_chunks`/`match_chunks_multi`,
`lib/qa/pipeline.ts`) untouched throughout — this only changes what the
ablation itself uses as its next baseline.**

**Root-caused the F-123 Q8 regression** (retrieval-only diagnostic, no
generation call — free): dense correctly ranked the target chunk
(`III.B.1.b`) at position 5 of 20; hybrid's RRF fusion bumped it to fused
rank 8 — 2 short of the top-6 cutoff — because two off-topic-but-jargon-
heavy chunks (`III.B.3`, `III.B.3.b`, from the same Coverage-B subsection)
out-ranked it on raw BM25 term density. Hand-checked whether retuning RRF's
`k` fixes it: it doesn't (k=10 makes it worse, k=200 barely ties). This is
a real dense-vs-keyword tradeoff, not a fusion bug — logged as evidence for
Block 2.3's router (dense-vs-hybrid per question) over a blanket
always-hybrid rule. Full analysis in
`docs/decisions/003-hybrid-retrieval-ablation.md`.

**2.2c continued — chunking knob (`MIN_CHUNK_CONTENT_CHARS` 50 vs 0) x
top-k knob (6 vs 10), run as a 2x2.** Made the 50-char drop threshold
overridable via a `CHUNK_MIN_CONTENT_CHARS` env var (default unchanged,
unset in every live/frozen path). Re-chunked and re-embedded fresh copies of
all 3 benchmark docs at the 0-char setting under new document rows
(`F-122-ABLATION-MC0` / `F-123-MC0` / `F-144-MC0`, `scripts/ingest-minchunk0.ts`)
— live F-122 and the existing 50-char rows untouched. ~29% more chunks at
0-char (every dropped sub-50-char stub becomes its own retrievable chunk).

Ran all 4 cells, hybrid only, real API calls, full 43-question corpus:

| cell | chunking | topK | PASS | FAIL | SEVERE | p50 ms | avg cost/q |
|---|---|---|---|---|---|---|---|
| A: baseline (ADR 003) | 50-char | 6 | 34 | 6 | 3 | 6,178 | $0.00658 |
| B: baseline+topK10 | 50-char | 10 | 36 | 4 | 3 | 6,422 | $0.00801 |
| C: MC0+topK6 | 0-char | 6 | 36 | 4 | 3 | 6,165 | $0.00629 |
| D: MC0+topK10 | 0-char | 10 | **39** | **2** | **2** | 6,341 | $0.00766 |

**Neither knob wins cleanly alone.** topK=10 alone (B) recovers the ADR 003
F-123 Q8 regression exactly as predicted, plus the corpus's hardest trap
question (F-122-ABL Q16) — zero regressions, but the chunk-drop SEVERE
(F-123 Q12, invented citation `II.B.1.C`) stays SEVERE, because no cutoff
size retrieves a chunk that doesn't exist. MC0 chunking alone (C) fixes that
exact SEVERE, but trades it for a *new* one — F-144 Q9 regresses from FAIL
to a fresh hallucinated citation (`V.D.3.A`), plus F-144 Q7 regresses
PASS→FAIL — real evidence that more, smaller chunks add retrieval noise
even as they close the coverage gap.

**Combined (D), the two knobs are complementary, not redundant:** every MC0
win survives, and topK=10's extra headroom absorbs both of C's regressions
(the correct F-144 passages make the cut instead of getting crowded out by
noise chunks). Net: 5 status changes, all wins, zero regressions — 39/43
PASS (90.7%), latency/cost still well inside the ADR 001 budget (p50 6.3s
vs an 8s budget, $0.0077/query vs a $0.03 budget). **After this leg, zero
remaining SEVEREs trace to retrieval or chunking** — both leftover SEVEREs
(F-123 Q13, F-144 Q10) are the same refusal-string-exactness issue ADR 003
already flagged, a generation/prompt-adherence fix, not a retrieval one.

**ADR 004 — Accepted:** MIN_CHUNK_CONTENT_CHARS=0 + topK=10 become the base
config for the remaining ablation legs (contextual chunks, reranker).
**Live path untouched** — `QA_TOP_K` stays 6, `MIN_CHUNK_CONTENT_CHARS`
stays 50 for every existing document; promoting either to production means
a one-time re-ingest backfill, out of scope here. Full analysis, leaderboard,
and per-cell row diffs in `docs/decisions/004-chunking-and-topk-ablation.md`
and `eval/chunking-topk-leaderboard.md`.

**Refusal-string-exactness fix — the corpus's last 2 SEVEREs.** Diagnosed
`F-123 Q13` / `F-144 Q10`: the model correctly decides to refuse (liability
questions outside this property-only policy's scope) and opens its answer
with the exact `REFUSAL_MESSAGE`, but then appends unsolicited explanation
for why, breaking the exact-match contract. Tried the obvious fix first —
tightened the system prompt's refusal rule to forbid any trailing text —
and it worked on both target cases, but **broke the frozen F-122 gate
(17/20 → 14/20)**: 3 previously-passing direct-hit questions started
refusing instead of answering, because removing the model's hedging outlet
shifted its refuse/answer decision boundary, not just its formatting.
**Reverted immediately, before committing**, per the "never regress below
17/20" invariant.

Replaced it with a deterministic post-check instead:
`normalizeRefusalAnswer()` (`lib/qa/constants.ts`, mirrored in
`apps/ai/app/constants.py`) collapses any answer that starts with the exact
`REFUSAL_MESSAGE` plus trailing text down to the canonical string, without
touching the prompt or the model's decision boundary. Wired into the one
production call site (`lib/anthropic.ts`), its Python mirror, and the
retrieval-lab harness's generation path. Frozen F-122 gate confirmed
unchanged (17/20, 0 SEVERE, same 3 pre-existing FAILs). Re-ran the full
43-question ablation corpus at ADR 004's best config (MC0+topK10+hybrid):
**39/43→41/43 PASS, 2 SEVERE→0 SEVERE** — zero SEVEREs remain anywhere in
either corpus. This is also a real production bug fix, not just an eval
artifact: the pipeline's citation-attachment logic keys off exact string
equality, so a padded refusal was silently shipping irrelevant citations
alongside a should-refuse answer before this fix. Full writeup, the
rejected prompt-tightening attempt, and the scorecard in
`docs/decisions/005-refusal-string-exactness-fix.md`;
`eval/sweep-d-mc0-topk10-refusalfix.md` has the corpus-wide row data.

**ADR 006 — Accepted: skip contextual retrieval and the reranker.** With
0 SEVERE and 41/43 PASS already clearing ADR 001's budgets at 79%
(latency)/26% (cost), the last two ablation-ladder rungs (Contextual
Retrieval, cross-encoder reranker) have no measured failure mode left to
fix — both remaining FAILs are pre-diagnosed ranking misses, not chunk-
context or ranking-depth problems. Full scorecard and "what would change
this" in `docs/decisions/006-skip-contextual-retrieval-and-reranker.md`.

**Shipped ADR 004's hybrid+topK10 retrieval and MC0 chunking to the live
path (ADR 007).** First confirmed where "live" actually runs: "Ask the
matter" hits `apps/ai`'s `POST /qa/matter` (Python) — a different code
path from the TS pipeline the frozen F-122 eval gate exercises; the
single-doc TS `answerMatterQuestion` is dead code.

Ported `eval/bm25.ts` to Python (`apps/ai/app/services/bm25.py`) as a
line-for-line translation, validated against a shared fixture generated
*from* the real TS implementation (`eval/bm25-parity-fixture.json`,
`scripts/gen-bm25-parity-fixture.ts`) — a hard gate per review: parity
passed exactly (id order + scores) on the first implementation, checked by
both a new Python test (`tests/test_bm25_parity.py`) and a TS regression
test (`eval/bm25-parity.test.ts`) so future drift on either side fails
loudly. Wired hybrid dense+BM25 (RRF-fused) retrieval into
`answer_matter_question` only, behind new `MATTER_QA_TOP_K=10` /
`MATTER_QA_POOL=20` constants — `answer_policy_question` (`/qa/answer`,
unused by any live UI) stays on the old `QA_TOP_K=6` dense-only config,
left as an explicit open item rather than expanded scope. Flipped
`MIN_CHUNK_CONTENT_CHARS`'s default 50→0 in `chunk-policy.ts` for documents
ingested from now on; F-122 and every other already-ingested doc keep
their existing chunks untouched. Added a `CHUNK_MIN_CONTENT_CHARS=50` guard
to the two historical ablation ingest scripts (`ingest-golden-docs.ts`,
`ingest-f122-ablation.ts`) so a rerun can't silently re-chunk the ADR
003/004 baseline rows at the new default.

Validated the actual shipped code, not just the TS approximation of it: a
new harness (`eval/live-matter-eval.ts`) hit the real `POST /qa/matter`
over HTTP — first accidentally against the still-live, not-yet-updated
Render deployment (a useful "before" data point: dense-only/topK=6 against
the MC0 docs, 37/43 PASS, 0 SEVERE, p50 6,866ms), then against a local
`uvicorn` run of the new code (real DB/Anthropic/OpenAI, same code Render
would run) for "after": **41/43 PASS, 0 SEVERE, p50 7,440ms, p95 9,868ms**
— accuracy matches ADR 004/005 exactly. Per the second hard gate, p50 is
under ADR 001's 8s budget but with a much thinner margin (~7%) than the TS
harness suggested (~19%), and this is a pre-deploy local proxy, not an
actual Render measurement (deploying requires a push, out of scope this
session). Flagged rather than absorbed — full tradeoff and two mitigation
options (accept and re-check post-deploy vs. pre-emptively trim
`MATTER_QA_TOP_K`/`MATTER_QA_POOL`) in
`docs/decisions/007-ship-hybrid-retrieval-to-live-matter-qa.md`. Frozen
F-122 gate reconfirmed unchanged (17/20, 0 SEVERE) throughout — none of
this touches that path. **Not yet deployed** — code complete, stopped
before committing per instruction.

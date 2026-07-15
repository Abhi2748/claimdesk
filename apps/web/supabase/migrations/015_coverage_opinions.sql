-- Coverage agent's structured cited output (Block 2.5c, ADR 009). Org-scoped
-- RLS mirrors 008/014 exactly: org_id NOT NULL via default_org_id(), select/
-- insert/update/delete all gated on user_org_ids(), demo read-only via
-- is_demo() restrictive policies. "matter_id" in the Python CoverageOpinion
-- schema (apps/ai/app/schemas/coverage.py) is this table's case_id — the
-- product calls a case a "matter" but the table follows the existing
-- cases/review_items naming. write_review_queue inserts one row here (the
-- immutable generated opinion) plus one row in review_items (kind=
-- 'coverage_analysis', ref_id -> this row's id, carrying the pending/
-- approved/rejected lifecycle) — matching the split 014 already anticipated.
-- Idempotent.
create table if not exists coverage_opinions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default default_org_id() references organizations(id) on delete cascade,
  case_id uuid not null references cases(id) on delete cascade,
  document_ids uuid[] not null default '{}',
  claim_summary text not null,
  verdict text not null check (verdict in ('covered','excluded','partial','unclear')),
  findings jsonb not null default '[]'::jsonb,
  overall_grounding_score double precision not null,
  model text not null,
  latency_ms integer not null,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
alter table coverage_opinions enable row level security;

drop policy if exists "coverage org select" on coverage_opinions;
drop policy if exists "coverage org insert" on coverage_opinions;
drop policy if exists "coverage org update" on coverage_opinions;
drop policy if exists "coverage org delete" on coverage_opinions;
drop policy if exists "demo ro coverage ins" on coverage_opinions;
drop policy if exists "demo ro coverage upd" on coverage_opinions;
drop policy if exists "demo ro coverage del" on coverage_opinions;

create policy "coverage org select" on coverage_opinions for select to authenticated
  using (org_id in (select user_org_ids()));
create policy "coverage org insert" on coverage_opinions for insert to authenticated
  with check (org_id in (select user_org_ids()) and created_by = auth.uid());
create policy "coverage org update" on coverage_opinions for update to authenticated
  using (org_id in (select user_org_ids())) with check (org_id in (select user_org_ids()));
create policy "coverage org delete" on coverage_opinions for delete to authenticated
  using (org_id in (select user_org_ids()));
create policy "demo ro coverage ins" on coverage_opinions as restrictive for insert to authenticated with check (not is_demo());
create policy "demo ro coverage upd" on coverage_opinions as restrictive for update to authenticated using (not is_demo());
create policy "demo ro coverage del" on coverage_opinions as restrictive for delete to authenticated using (not is_demo());

create index if not exists coverage_opinions_org_case_idx on coverage_opinions (org_id, case_id, created_at desc);
notify pgrst, 'reload schema';

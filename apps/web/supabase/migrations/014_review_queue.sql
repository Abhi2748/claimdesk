-- Human-in-the-loop review queue for AI outputs. Org-scoped RLS (mirrors 008),
-- demo read-only (mirrors 004). Generic kind + optional ref_id/snapshot so
-- letters / coverage analyses slot in later via the same insert. Idempotent.
create table if not exists review_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default default_org_id() references organizations(id) on delete cascade,
  case_id uuid references cases(id) on delete cascade,
  kind text not null check (kind in ('qa_answer','letter','coverage_analysis')),
  ref_id uuid,
  title text not null,
  summary text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_by uuid not null default auth.uid() references auth.users(id),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);
alter table review_items enable row level security;

drop policy if exists "review org select" on review_items;
drop policy if exists "review org insert" on review_items;
drop policy if exists "review org update" on review_items;
drop policy if exists "review org delete" on review_items;
drop policy if exists "demo ro review ins" on review_items;
drop policy if exists "demo ro review upd" on review_items;
drop policy if exists "demo ro review del" on review_items;

create policy "review org select" on review_items for select to authenticated
  using (org_id in (select user_org_ids()));
create policy "review org insert" on review_items for insert to authenticated
  with check (org_id in (select user_org_ids()) and created_by = auth.uid());
create policy "review org update" on review_items for update to authenticated
  using (org_id in (select user_org_ids())) with check (org_id in (select user_org_ids()));
create policy "review org delete" on review_items for delete to authenticated
  using (org_id in (select user_org_ids()));
create policy "demo ro review ins" on review_items as restrictive for insert to authenticated with check (not is_demo());
create policy "demo ro review upd" on review_items as restrictive for update to authenticated using (not is_demo());
create policy "demo ro review del" on review_items as restrictive for delete to authenticated using (not is_demo());

create index if not exists review_items_org_status_idx on review_items (org_id, status, created_at desc);
notify pgrst, 'reload schema';

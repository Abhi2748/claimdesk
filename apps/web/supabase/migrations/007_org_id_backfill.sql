-- ============================================================
-- 007_org_id_backfill.sql — Act Three, Block 0.5b
-- Add org_id to the four per-user tables, auto-stamp new rows, backfill
-- existing rows to the default org. NO RLS cutover — existing
-- created_by policies stay in charge, so the app + demo keep working.
--
-- Run:  Supabase → SQL Editor → paste whole file → Run. Idempotent.
-- Depends on: 006_org_foundation.sql (organizations, memberships).
-- ============================================================

-- 1. Helper: the org to stamp on a new row -------------------------------
-- Resolves the current user's org; if there is no user context (e.g. a
-- SECURITY DEFINER/service insert like reset_demo), falls back to the default
-- org so no row is ever left without an org_id. TRANSITIONAL: revisit when
-- users can belong to multiple orgs (inserts will then pass org_id explicitly).
create or replace function default_org_id()
returns uuid language sql stable as $$
  select coalesce(
    (select org_id from memberships where user_id = auth.uid() order by created_at limit 1),
    (select id from organizations where slug = 'default')
  );
$$;
grant execute on function default_org_id() to authenticated;

-- 2. Add the column (nullable, fast metadata-only), then a default ------
alter table cases     add column if not exists org_id uuid references organizations(id);
alter table documents add column if not exists org_id uuid references organizations(id);
alter table chunks    add column if not exists org_id uuid references organizations(id);
alter table letters   add column if not exists org_id uuid references organizations(id);

alter table cases     alter column org_id set default default_org_id();
alter table documents alter column org_id set default default_org_id();
alter table chunks    alter column org_id set default default_org_id();
alter table letters   alter column org_id set default default_org_id();

-- 3. Backfill every existing row to the default org --------------------
do $$
declare v_default uuid;
begin
  select id into v_default from organizations where slug = 'default';
  if v_default is null then
    raise exception 'Default org not found — run 006_org_foundation.sql first.';
  end if;

  update cases     set org_id = v_default where org_id is null;
  update documents set org_id = v_default where org_id is null;
  update chunks    set org_id = v_default where org_id is null;
  update letters   set org_id = v_default where org_id is null;
end $$;

-- 4. Indexes for the org-scoped lookups that 0.5c will use -------------
create index if not exists cases_org_idx     on cases (org_id);
create index if not exists documents_org_idx on documents (org_id);
create index if not exists chunks_org_idx    on chunks (org_id);
create index if not exists letters_org_idx   on letters (org_id);

-- NOTE: org_id is intentionally left NULLABLE for now. It is set NOT NULL in
-- 0.5c, once we have confirmed every write path (app, demo letter insert,
-- reset_demo) populates it — and alongside the actual RLS cutover.

notify pgrst, 'reload schema';

-- ============================================================
-- 006_org_foundation.sql — Act Three, Block 0.5a
-- ADDITIVE multi-tenant FOUNDATION.
--
-- What this does:  creates organizations + memberships + audit_log tables,
--                  membership helper functions, RLS on the NEW tables only,
--                  and backfills one default org enrolling every existing user.
--
-- What this does NOT do:  it does not alter cases/documents/chunks/letters,
--                  does not change any existing policy, does not touch demo
--                  mode, is_demo(), match_chunks, reset_demo, or storage.
--                  Your existing single-tenant RLS (created_by = auth.uid())
--                  stays exactly as-is. Safe to run on the live database.
--
-- Run:  Supabase → SQL Editor → New query → paste this whole file → Run.
-- ============================================================

-- 1. Role enum -------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_type where typname = 'org_role') then
    create type org_role as enum ('owner','admin','member');
  end if;
end $$;

-- 2. Tables ----------------------------------------------------
create table if not exists organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists memberships (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,
  user_id    uuid not null references auth.users(id)    on delete cascade,
  role       org_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);
create index if not exists memberships_user_idx on memberships (user_id);
create index if not exists memberships_org_idx  on memberships (org_id);

create table if not exists audit_log (
  id            bigint generated always as identity primary key,
  org_id        uuid references organizations(id) on delete set null,
  actor_user_id uuid references auth.users(id)    on delete set null,
  action        text not null,
  target_type   text,
  target_id     text,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists audit_log_org_time_idx on audit_log (org_id, created_at desc);

-- 3. Membership helpers ---------------------------------------
-- SECURITY DEFINER: these read memberships while BYPASSING RLS, so a policy
-- placed ON the memberships table that calls user_org_ids() does NOT recurse.
-- This is the recursion trap referenced above; solving it here keeps the
-- memberships policy in section 4 safe.
create or replace function user_org_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select org_id from memberships where user_id = auth.uid();
$$;
grant execute on function user_org_ids() to authenticated;

create or replace function is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from memberships where org_id = p_org and user_id = auth.uid());
$$;
grant execute on function is_org_member(uuid) to authenticated;

-- named current_org_role (not org_role) to avoid clashing with the enum type
create or replace function current_org_role(p_org uuid)
returns org_role language sql stable security definer set search_path = public as $$
  select role from memberships where org_id = p_org and user_id = auth.uid();
$$;
grant execute on function current_org_role(uuid) to authenticated;

-- 4. RLS on the NEW tables ONLY -------------------------------
alter table organizations enable row level security;
alter table memberships   enable row level security;
alter table audit_log     enable row level security;

drop policy if exists "member reads org" on organizations;
create policy "member reads org" on organizations
  for select to authenticated using (is_org_member(id));

drop policy if exists "reads own plus co-members" on memberships;
create policy "reads own plus co-members" on memberships
  for select to authenticated
  using (user_id = auth.uid() or org_id in (select user_org_ids()));

drop policy if exists "member reads audit" on audit_log;
create policy "member reads audit" on audit_log
  for select to authenticated using (org_id in (select user_org_ids()));

drop policy if exists "member writes audit" on audit_log;
create policy "member writes audit" on audit_log
  for insert to authenticated with check (org_id in (select user_org_ids()));
-- append-only: no update/delete policies exist, so under RLS both are denied.

-- 5. Backfill: one default org, enroll every existing user -----
do $$
declare
  v_org   uuid;
  v_owner uuid;
begin
  -- default org (idempotent on slug)
  select id into v_org from organizations where slug = 'default';
  if v_org is null then
    insert into organizations (name, slug)
      values ('ClaimDesk (Default Org)', 'default')
      returning id into v_org;
  end if;

  -- enroll every existing auth user as a member (skip if already enrolled)
  insert into memberships (org_id, user_id, role)
  select v_org, u.id, 'member'::org_role
  from auth.users u
  where not exists (
    select 1 from memberships m where m.org_id = v_org and m.user_id = u.id
  );

  -- promote the original owner (creator of the Alvarez seed case, not the demo
  -- copy) to 'owner'
  select c.created_by into v_owner
  from cases c
  join auth.users u on u.id = c.created_by
  where c.title like 'Alvarez v. Shield Mutual%'
    and u.email <> 'demo@claimdesk.app'
  order by c.created_at
  limit 1;

  if v_owner is not null then
    update memberships set role = 'owner'
      where org_id = v_org and user_id = v_owner;
  end if;
end $$;

notify pgrst, 'reload schema';

-- ============================================================
-- 004_demo_readonly.sql — Block 1A-ii: demo read-only + AI rate limit
-- Restrictive policies AND with the existing permissive "own X" policies.
-- SELECT is left untouched, so the demo user can still READ its own rows;
-- writes are blocked for the demo user only. Idempotent (drops first).
-- ============================================================

-- 1. Demo identity from the JWT email claim ----------------------
--    MUST match DEMO_USER_EMAIL and seed-demo.sql.
create or replace function is_demo()
returns boolean language sql stable as $$
  select coalesce((auth.jwt() ->> 'email') = 'demo@claimdesk.app', false);
$$;
grant execute on function is_demo() to authenticated;

-- 2. Read-only enforcement (restrictive policies) ----------------
drop policy if exists "demo ro cases ins"  on cases;
drop policy if exists "demo ro cases upd"  on cases;
drop policy if exists "demo ro cases del"  on cases;
drop policy if exists "demo ro docs ins"   on documents;
drop policy if exists "demo ro docs upd"   on documents;
drop policy if exists "demo ro docs del"   on documents;
drop policy if exists "demo ro chunks ins" on chunks;
drop policy if exists "demo ro chunks upd" on chunks;
drop policy if exists "demo ro chunks del" on chunks;
drop policy if exists "demo ro letters upd" on letters;
drop policy if exists "demo ro letters del" on letters;
drop policy if exists "demo ro storage ins" on storage.objects;
drop policy if exists "demo ro storage del" on storage.objects;

-- cases / documents / chunks: block ALL writes for demo
create policy "demo ro cases ins"  on cases     as restrictive for insert with check (not is_demo());
create policy "demo ro cases upd"  on cases     as restrictive for update using (not is_demo()) with check (not is_demo());
create policy "demo ro cases del"  on cases     as restrictive for delete using (not is_demo());
create policy "demo ro docs ins"   on documents as restrictive for insert with check (not is_demo());
create policy "demo ro docs upd"   on documents as restrictive for update using (not is_demo()) with check (not is_demo());
create policy "demo ro docs del"   on documents as restrictive for delete using (not is_demo());
create policy "demo ro chunks ins" on chunks    as restrictive for insert with check (not is_demo());
create policy "demo ro chunks upd" on chunks    as restrictive for update using (not is_demo()) with check (not is_demo());
create policy "demo ro chunks del" on chunks    as restrictive for delete using (not is_demo());

-- letters: ALLOW insert (drafting is a demo feature); block edits + deletes
create policy "demo ro letters upd" on letters  as restrictive for update using (not is_demo()) with check (not is_demo());
create policy "demo ro letters del" on letters  as restrictive for delete using (not is_demo());

-- storage: block uploads + deletes for demo (demo never reads storage)
create policy "demo ro storage ins" on storage.objects as restrictive for insert to authenticated with check (not is_demo());
create policy "demo ro storage del" on storage.objects as restrictive for delete to authenticated using (not is_demo());

-- 3. Per-IP AI rate limiting -------------------------------------
create table if not exists demo_rate_limit (
  id bigint generated always as identity primary key,
  ip text not null,
  created_at timestamptz not null default now()
);
create index if not exists demo_rate_limit_ip_time_idx on demo_rate_limit (ip, created_at);
alter table demo_rate_limit enable row level security;  -- no policies: only the definer fn touches it

drop function if exists demo_rate_limit_check(text, int, interval);

create or replace function demo_rate_limit_check(p_ip text, p_max int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  perform pg_advisory_xact_lock(hashtext(p_ip));
  delete from demo_rate_limit where created_at < now() - interval '2 hours';
  select count(*) into v_count from demo_rate_limit
    where ip = p_ip and created_at > now() - make_interval(secs => p_window_seconds);
  if v_count >= p_max then
    return false;
  end if;
  insert into demo_rate_limit (ip) values (p_ip);
  return true;
end $$;

grant execute on function demo_rate_limit_check(text, int, int) to authenticated;
notify pgrst, 'reload schema';
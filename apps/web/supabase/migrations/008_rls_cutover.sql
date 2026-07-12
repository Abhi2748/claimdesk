-- ============================================================
-- 008_rls_cutover.sql — Act Three, Block 0.5c  (THE CUTOVER)
-- Flip the four data tables from single-tenant (created_by = auth.uid())
-- to org-scoped (org_id in my orgs). Also split the demo user into its own
-- isolated "demo" org so tenants are provably separated and the eval sees
-- exactly one policy document.
--
-- Preserves: demo read-only restrictive policies (004), deadline_rules read,
--            match_chunks, storage policies (unchanged — org-scoping storage is
--            deferred). RBAC/MFA come in 0.5d.
--
-- Run:  Supabase → SQL Editor → paste whole file → Run. Depends on 006 + 007.
-- ============================================================

-- 1. Create the demo org, move the demo user into it -------------------
do $$
declare
  v_demo      uuid;
  v_demo_org  uuid;
begin
  select id into v_demo from auth.users where email = 'demo@claimdesk.app';
  if v_demo is null then raise exception 'Demo user not found.'; end if;

  select id into v_demo_org from organizations where slug = 'demo';
  if v_demo_org is null then
    insert into organizations (name, slug) values ('ClaimDesk Demo', 'demo')
      returning id into v_demo_org;
  end if;

  -- move demo's membership: out of default, into the demo org (as its owner)
  delete from memberships
    where user_id = v_demo
      and org_id = (select id from organizations where slug = 'default');
  insert into memberships (org_id, user_id, role)
    values (v_demo_org, v_demo, 'owner')
    on conflict (org_id, user_id) do update set role = 'owner';

  -- 2. Re-stamp every demo-owned row into the demo org ----------------
  update cases     set org_id = v_demo_org where created_by = v_demo;
  update documents set org_id = v_demo_org where created_by = v_demo;
  update chunks    set org_id = v_demo_org where created_by = v_demo;
  update letters   set org_id = v_demo_org where created_by = v_demo;
end $$;

-- 3. Lock org_id down (all rows are stamped; defaults cover new rows) --
alter table cases     alter column org_id set not null;
alter table documents alter column org_id set not null;
alter table chunks    alter column org_id set not null;
alter table letters   alter column org_id set not null;

-- 4. THE CUTOVER: replace created_by policies with org-scoped ones -----
-- Access is now by org membership. created_by stays as an attribution field
-- and is enforced on INSERT so a user can't forge authorship.

-- cases
drop policy if exists "own cases" on cases;
create policy "org select cases" on cases for select to authenticated
  using (org_id in (select user_org_ids()));
create policy "org insert cases" on cases for insert to authenticated
  with check (org_id in (select user_org_ids()) and created_by = auth.uid());
create policy "org update cases" on cases for update to authenticated
  using (org_id in (select user_org_ids())) with check (org_id in (select user_org_ids()));
create policy "org delete cases" on cases for delete to authenticated
  using (org_id in (select user_org_ids()));

-- documents
drop policy if exists "own documents" on documents;
create policy "org select documents" on documents for select to authenticated
  using (org_id in (select user_org_ids()));
create policy "org insert documents" on documents for insert to authenticated
  with check (org_id in (select user_org_ids()) and created_by = auth.uid());
create policy "org update documents" on documents for update to authenticated
  using (org_id in (select user_org_ids())) with check (org_id in (select user_org_ids()));
create policy "org delete documents" on documents for delete to authenticated
  using (org_id in (select user_org_ids()));

-- chunks
drop policy if exists "own chunks" on chunks;
create policy "org select chunks" on chunks for select to authenticated
  using (org_id in (select user_org_ids()));
create policy "org insert chunks" on chunks for insert to authenticated
  with check (org_id in (select user_org_ids()) and created_by = auth.uid());
create policy "org update chunks" on chunks for update to authenticated
  using (org_id in (select user_org_ids())) with check (org_id in (select user_org_ids()));
create policy "org delete chunks" on chunks for delete to authenticated
  using (org_id in (select user_org_ids()));

-- letters
drop policy if exists "own letters" on letters;
create policy "org select letters" on letters for select to authenticated
  using (org_id in (select user_org_ids()));
create policy "org insert letters" on letters for insert to authenticated
  with check (org_id in (select user_org_ids()) and created_by = auth.uid());
create policy "org update letters" on letters for update to authenticated
  using (org_id in (select user_org_ids())) with check (org_id in (select user_org_ids()));
create policy "org delete letters" on letters for delete to authenticated
  using (org_id in (select user_org_ids()));

-- NOTE: the 004 demo restrictive write-block policies are UNTOUCHED and still
-- apply on top of these (they AND together), so the demo user stays read-only
-- (letters insert still allowed).

-- 5. Keep demo-reset inside the demo org ------------------------------
create or replace function reset_demo()
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  v_demo_email text := 'demo@claimdesk.app';
  v_demo uuid; v_src uuid; v_demo_org uuid; r_case record; r_doc record;
  new_case_id uuid; new_doc_id uuid;
begin
  select id into v_demo from auth.users where email = v_demo_email;
  if v_demo is null then raise exception 'Demo user % not found.', v_demo_email; end if;

  select id into v_demo_org from organizations where slug = 'demo';
  if v_demo_org is null then raise exception 'Demo org not found — run 008 first.'; end if;

  select created_by into v_src from cases
    where title like 'Alvarez v. Shield Mutual%' and created_by <> v_demo
    order by created_at limit 1;
  if v_src is null then raise exception 'Source seed data not found.'; end if;

  delete from letters where created_by = v_demo;
  delete from cases   where created_by = v_demo;   -- cascades to documents + chunks

  for r_case in select * from cases where created_by = v_src loop
    new_case_id := gen_random_uuid();
    insert into cases (id, org_id, created_by, title, client_name, claim_type, insurer, policy_number,
                       state, date_of_loss, amount_offered, amount_claimed, status, is_nfip, created_at)
    values (new_case_id, v_demo_org, v_demo, r_case.title, r_case.client_name, r_case.claim_type, r_case.insurer,
            r_case.policy_number, r_case.state, r_case.date_of_loss, r_case.amount_offered,
            r_case.amount_claimed, r_case.status, r_case.is_nfip, r_case.created_at);
    for r_doc in select * from documents where case_id = r_case.id loop
      new_doc_id := gen_random_uuid();
      insert into documents (id, org_id, case_id, created_by, storage_path, doc_type, title, page_count,
                             ingest_status, toc_tree, ingest_stats, created_at)
      values (new_doc_id, v_demo_org, new_case_id, v_demo, r_doc.storage_path, r_doc.doc_type, r_doc.title,
              r_doc.page_count, r_doc.ingest_status, r_doc.toc_tree, r_doc.ingest_stats, r_doc.created_at);
      insert into chunks (document_id, org_id, created_by, section_label, page_start, page_end, content, embedding, created_at)
      select new_doc_id, v_demo_org, v_demo, section_label, page_start, page_end, content, embedding, created_at
        from chunks where document_id = r_doc.id;
    end loop;
  end loop;
end $$;

revoke all on function reset_demo() from public;
grant execute on function reset_demo() to service_role;

notify pgrst, 'reload schema';

-- ============================================================
-- 012_storage_org_scope.sql — Act Three, Block 1.2a
-- Cut the case-documents bucket from owner-only (001) to org-scoped, mirroring
-- the 008 data-table cutover. Access derives from the object path's first
-- folder segment: <org_id>/<case_id>/<filename>.
-- The 004 demo restrictive storage policies are LEFT INTACT (they AND on top).
-- Physical relocation of any legacy <user_id>/... object is done out-of-band by
-- a one-time service-role move script — SQL can't move the bytes.
-- Run: Supabase → SQL Editor → paste whole file → Run. Depends on 006/008.
-- Idempotent (drops first).
-- ============================================================

-- 1. Drop owner-only policies (001) and any prior run of the new ones ---
drop policy if exists "upload own case docs"  on storage.objects;
drop policy if exists "read own case docs"    on storage.objects;
drop policy if exists "delete own case docs"  on storage.objects;
drop policy if exists "org read case docs"    on storage.objects;
drop policy if exists "org upload case docs"  on storage.objects;
drop policy if exists "org update case docs"  on storage.objects;
drop policy if exists "org delete case docs"  on storage.objects;

-- 2. Org-scoped policies (path prefix = org_id) ------------------------
-- storage.foldername('<org>/<case>/<file>') = {'<org>','<case>'} → [1] = org.
-- Every stored name is uuid-prefixed (enforced by the insert WITH CHECK below),
-- so the ::uuid cast never sees a non-uuid segment.
create policy "org read case docs" on storage.objects
  for select to authenticated using (
    bucket_id = 'case-documents'
    and ((storage.foldername(name))[1])::uuid in (select user_org_ids())
  );

create policy "org upload case docs" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'case-documents'
    and ((storage.foldername(name))[1])::uuid in (select user_org_ids())
  );

create policy "org update case docs" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'case-documents'
    and ((storage.foldername(name))[1])::uuid in (select user_org_ids())
  )
  with check (
    bucket_id = 'case-documents'
    and ((storage.foldername(name))[1])::uuid in (select user_org_ids())
  );

create policy "org delete case docs" on storage.objects
  for delete to authenticated using (
    bucket_id = 'case-documents'
    and ((storage.foldername(name))[1])::uuid in (select user_org_ids())
  );

notify pgrst, 'reload schema';
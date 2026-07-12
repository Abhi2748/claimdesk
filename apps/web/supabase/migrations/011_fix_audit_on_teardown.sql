-- ============================================================
-- 011_fix_audit_on_teardown.sql — Act Three, Block 0.5d-i (fix 2)
-- The 009 audit trigger tried to log 'member.removed' during an org teardown,
-- but by then the org row is already gone, so the audit_log FK
-- (audit_log_org_id_fkey) rejected the insert and blocked the whole delete.
-- Fix: skip the removal-audit when the parent org no longer exists.
--
-- Run:  Supabase → SQL Editor → paste whole file → Run.
-- ============================================================

create or replace function audit_membership_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    insert into audit_log (org_id, actor_user_id, action, target_type, target_id, metadata)
    values (NEW.org_id, auth.uid(), 'member.added', 'membership', NEW.user_id::text,
            jsonb_build_object('role', NEW.role));
    return NEW;

  elsif TG_OP = 'UPDATE' then
    insert into audit_log (org_id, actor_user_id, action, target_type, target_id, metadata)
    values (NEW.org_id, auth.uid(), 'member.role_changed', 'membership', NEW.user_id::text,
            jsonb_build_object('from', OLD.role, 'to', NEW.role));
    return NEW;

  else -- DELETE
    -- If the org is being torn down, its row is already gone; logging a removal
    -- against it would violate audit_log_org_id_fkey. Skip it in that case.
    if exists (select 1 from organizations where id = OLD.org_id) then
      insert into audit_log (org_id, actor_user_id, action, target_type, target_id, metadata)
      values (OLD.org_id, auth.uid(), 'member.removed', 'membership', OLD.user_id::text,
              jsonb_build_object('role', OLD.role));
    end if;
    return OLD;
  end if;
end $$;

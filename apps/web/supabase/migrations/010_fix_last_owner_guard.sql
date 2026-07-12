-- ============================================================
-- 010_fix_last_owner_guard.sql — Act Three, Block 0.5d-i (fix)
-- The 009 last-owner guard was too blunt: it blocked removing the last owner
-- even when the ENTIRE org is being deleted (org delete cascades to memberships).
-- Refine it: only block when removing/demoting the last owner would leave OTHER
-- members behind with no owner. Org teardown and sole-member departure are then
-- allowed (nothing to orphan).
--
-- Run:  Supabase → SQL Editor → paste whole file → Run.
-- ============================================================

create or replace function prevent_last_owner_removal()
returns trigger language plpgsql as $$
declare
  v_owners_after  int;
  v_members_after int;
begin
  -- Only relevant when an owner is being removed (DELETE) or demoted (UPDATE).
  if (TG_OP = 'DELETE' and OLD.role = 'owner')
     or (TG_OP = 'UPDATE' and OLD.role = 'owner' and NEW.role <> 'owner') then

    if TG_OP = 'DELETE' then
      -- after this delete the row is gone
      select count(*) filter (where role = 'owner'), count(*)
        into v_owners_after, v_members_after
        from memberships
        where org_id = OLD.org_id and id <> OLD.id;
    else -- UPDATE (demotion): the row stays, but no longer an owner
      select count(*) filter (where role = 'owner' and id <> OLD.id), count(*)
        into v_owners_after, v_members_after
        from memberships
        where org_id = OLD.org_id;
    end if;

    -- Block ONLY if this would leave members behind with zero owners.
    if v_owners_after = 0 and v_members_after > 0 then
      raise exception
        'Cannot remove the last owner while other members remain in the organization';
    end if;
  end if;

  return case TG_OP when 'DELETE' then OLD else NEW end;
end $$;

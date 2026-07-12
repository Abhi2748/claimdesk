-- ============================================================
-- 009_rbac_audit.sql — Act Three, Block 0.5d-i
-- Role-based access control for org administration + automatic audit logging.
-- ADDITIVE: enables new capabilities (admins manage members, users create orgs,
-- audit trail). Does NOT change access to cases/documents/chunks/letters.
--
-- Run:  Supabase → SQL Editor → paste whole file → Run. Depends on 006–008.
-- ============================================================

-- 1. RBAC: who can administer an org --------------------------------
-- memberships currently has only a SELECT policy (0.5a). Add write policies
-- gated to owner/admin via current_org_role(). current_org_role is
-- SECURITY DEFINER, so referencing it in a policy ON memberships does not recurse.

create policy "admin adds members" on memberships for insert to authenticated
  with check (current_org_role(org_id) in ('owner','admin'));

create policy "admin updates members" on memberships for update to authenticated
  using (current_org_role(org_id) in ('owner','admin'))
  with check (current_org_role(org_id) in ('owner','admin'));

create policy "admin removes members" on memberships for delete to authenticated
  using (current_org_role(org_id) in ('owner','admin'));

-- organizations: only an owner may rename/update their org
create policy "owner updates org" on organizations for update to authenticated
  using (current_org_role(id) = 'owner')
  with check (current_org_role(id) = 'owner');

-- 2. Bootstrap: let an authenticated user create an org (becomes its owner) ---
-- Needed because the "admin adds members" policy above can't apply to the very
-- first membership of a brand-new org (chicken-and-egg). This definer function
-- creates the org and the owner membership atomically, bypassing that.
create or replace function create_organization(p_name text, p_slug text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  insert into organizations (name, slug) values (p_name, p_slug) returning id into v_org;
  insert into memberships (org_id, user_id, role) values (v_org, v_uid, 'owner');
  return v_org;
end $$;
grant execute on function create_organization(text, text) to authenticated;

-- 3. Safety: never remove the last owner of an org ------------------
create or replace function prevent_last_owner_removal()
returns trigger language plpgsql as $$
declare v_owners int;
begin
  if (TG_OP = 'DELETE' and OLD.role = 'owner')
     or (TG_OP = 'UPDATE' and OLD.role = 'owner' and NEW.role <> 'owner') then
    select count(*) into v_owners from memberships
      where org_id = OLD.org_id and role = 'owner';
    if v_owners <= 1 then
      raise exception 'Cannot remove the last owner of an organization';
    end if;
  end if;
  return case TG_OP when 'DELETE' then OLD else NEW end;
end $$;

drop trigger if exists trg_prevent_last_owner on memberships;
create trigger trg_prevent_last_owner
  before update or delete on memberships
  for each row execute function prevent_last_owner_removal();

-- 4. Automatic audit logging ---------------------------------------
-- SECURITY DEFINER so the trigger can always write to audit_log regardless of
-- the actor's own audit insert policy. auth.uid() still reflects the caller.
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
    insert into audit_log (org_id, actor_user_id, action, target_type, target_id, metadata)
    values (OLD.org_id, auth.uid(), 'member.removed', 'membership', OLD.user_id::text,
            jsonb_build_object('role', OLD.role));
    return OLD;
  end if;
end $$;

drop trigger if exists trg_audit_membership on memberships;
create trigger trg_audit_membership
  after insert or update or delete on memberships
  for each row execute function audit_membership_change();

create or replace function audit_org_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log (org_id, actor_user_id, action, target_type, target_id, metadata)
  values (NEW.id, auth.uid(), 'org.updated', 'organization', NEW.id::text,
          jsonb_build_object('name', NEW.name));
  return NEW;
end $$;

drop trigger if exists trg_audit_org on organizations;
create trigger trg_audit_org
  after update on organizations
  for each row execute function audit_org_update();

notify pgrst, 'reload schema';

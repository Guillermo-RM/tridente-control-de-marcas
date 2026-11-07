-- Remove a worker from operations while retaining the profile key for history.
begin;

alter table public.profiles
  add column deleted_at timestamptz,
  add constraint deleted_profile_is_inactive_worker
    check (deleted_at is null or (role = 'worker' and not active));

create function public.remove_worker(
  p_organization_id uuid, p_worker_id uuid, p_master_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted_at timestamptz := now();
begin
  if not exists (
    select 1 from public.profiles p
    join public.organizations o on o.id = p.organization_id
    where p.id = p_master_id and p.organization_id = p_organization_id
      and p.role = 'master' and p.active and o.active
  ) then
    raise exception 'master_not_allowed' using errcode = '42501';
  end if;

  update public.profiles
  set active = false, deleted_at = v_deleted_at
  where id = p_worker_id and organization_id = p_organization_id
    and role = 'worker' and deleted_at is null;

  if not found then return; end if;

  update public.worker_assignments
  set active = false
  where worker_id = p_worker_id and organization_id = p_organization_id and active;

  insert into public.audit_logs (
    organization_id, actor_user_id, action, entity_type, entity_id, after_data
  ) values (
    p_organization_id, p_master_id, 'worker.delete', 'worker', p_worker_id,
    jsonb_build_object('active', false, 'deleted_at', v_deleted_at)
  );
end;
$$;

create function public.prevent_removed_worker_assignment()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_deleted_at timestamptz;
begin
  select p.deleted_at into v_deleted_at
  from public.profiles p
  where p.id = new.worker_id and p.organization_id = new.organization_id
  for share;

  if v_deleted_at is not null then
    raise exception 'worker_removed' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger prevent_removed_worker_assignment
before insert or update on public.worker_assignments
for each row when (new.active)
execute function public.prevent_removed_worker_assignment();

revoke all on function public.remove_worker(uuid, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.remove_worker(uuid, uuid, uuid) to service_role;
revoke all on function public.prevent_removed_worker_assignment()
  from public, anon, authenticated, service_role;

notify pgrst, 'reload schema';
commit;

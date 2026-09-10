begin;

create type public.location_status as enum ('verified', 'outside', 'unavailable');

alter table public.profiles
  add constraint profiles_id_organization_unique unique (id, organization_id);
alter table public.profiles add column email text;
create unique index profiles_email_per_organization_unique
  on public.profiles (organization_id, lower(email)) where email is not null;

create table public.condominiums (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 2 and 120),
  address text not null check (char_length(trim(address)) between 3 and 300),
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  timezone text not null default 'America/Costa_Rica',
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint condominium_coordinates_together check (
    (latitude is null and longitude is null)
    or (latitude between -90 and 90 and longitude between -180 and 180)
  )
);

create unique index condominiums_name_per_organization_unique
  on public.condominiums (organization_id, lower(name));
alter table public.condominiums
  add constraint condominiums_id_organization_unique unique (id, organization_id);
create index condominiums_organization_active_idx
  on public.condominiums (organization_id, name) where active;

create table public.worker_assignments (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  worker_id uuid not null,
  condominium_id uuid not null,
  active boolean not null default true,
  assigned_by uuid not null references auth.users(id) on delete restrict,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (worker_id, condominium_id),
  foreign key (worker_id, organization_id)
    references public.profiles(id, organization_id) on delete restrict,
  foreign key (condominium_id, organization_id)
    references public.condominiums(id, organization_id) on delete restrict
);

create index worker_assignments_condominium_idx
  on public.worker_assignments (condominium_id, worker_id) where active;

create table public.checkpoints (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  condominium_id uuid not null,
  name text not null check (char_length(trim(name)) between 2 and 120),
  description text check (description is null or char_length(description) <= 500),
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  radius_meters integer not null default 75 check (radius_meters between 10 and 1000),
  token_version integer not null default 1 check (token_version > 0),
  active boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (condominium_id, organization_id)
    references public.condominiums(id, organization_id) on delete restrict,
  constraint checkpoint_coordinates_together check (
    (latitude is null and longitude is null)
    or (latitude between -90 and 90 and longitude between -180 and 180)
  )
);

create unique index checkpoints_name_per_condominium_unique
  on public.checkpoints (condominium_id, lower(name));
create index checkpoints_organization_condominium_idx
  on public.checkpoints (organization_id, condominium_id) where active;

create table public.scan_events (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  condominium_id uuid not null references public.condominiums(id) on delete restrict,
  checkpoint_id uuid not null references public.checkpoints(id) on delete restrict,
  worker_id uuid not null references public.profiles(id) on delete restrict,
  worker_name_snapshot text not null,
  checkpoint_name_snapshot text not null,
  ip_address inet,
  user_agent text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  accuracy_meters numeric(10, 2),
  distance_meters numeric(10, 2),
  location_status public.location_status not null,
  client_scanned_at timestamptz,
  scanned_at timestamptz not null default now(),
  constraint scan_coordinates_together check (
    (latitude is null and longitude is null)
    or (latitude between -90 and 90 and longitude between -180 and 180)
  ),
  constraint scan_accuracy_positive check (
    accuracy_meters is null or accuracy_meters >= 0
  )
);

create index scan_events_organization_scanned_idx
  on public.scan_events (organization_id, scanned_at desc);
create index scan_events_worker_scanned_idx
  on public.scan_events (worker_id, scanned_at desc);
create index scan_events_checkpoint_scanned_idx
  on public.scan_events (checkpoint_id, scanned_at desc);

create trigger condominiums_set_updated_at
before update on public.condominiums
for each row execute function public.set_updated_at();

create trigger worker_assignments_set_updated_at
before update on public.worker_assignments
for each row execute function public.set_updated_at();

create trigger checkpoints_set_updated_at
before update on public.checkpoints
for each row execute function public.set_updated_at();

create or replace function public.record_scan_event(
  p_worker_id uuid,
  p_checkpoint_id uuid,
  p_ip_address inet,
  p_user_agent text,
  p_latitude numeric,
  p_longitude numeric,
  p_accuracy_meters numeric,
  p_distance_meters numeric,
  p_location_status public.location_status,
  p_client_scanned_at timestamptz
)
returns table(scan_id uuid, created boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  worker_row public.profiles%rowtype;
  checkpoint_row public.checkpoints%rowtype;
  existing_id uuid;
begin
  select * into worker_row
  from public.profiles
  where id = p_worker_id and role = 'worker' and active;

  if not found then raise exception 'worker_not_allowed'; end if;

  select cp.* into checkpoint_row
  from public.checkpoints cp
  join public.condominiums c on c.id = cp.condominium_id
  where cp.id = p_checkpoint_id
    and cp.active and c.active
    and cp.organization_id = worker_row.organization_id;

  if not found then raise exception 'checkpoint_not_allowed'; end if;

  if not exists (
    select 1 from public.worker_assignments wa
    where wa.worker_id = p_worker_id
      and wa.condominium_id = checkpoint_row.condominium_id
      and wa.organization_id = worker_row.organization_id
      and wa.active
  ) then raise exception 'assignment_required'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_worker_id::text || p_checkpoint_id::text, 0)
  );

  select se.id into existing_id
  from public.scan_events se
  where se.worker_id = p_worker_id
    and se.checkpoint_id = p_checkpoint_id
    and se.scanned_at > now() - interval '60 seconds'
  order by se.scanned_at desc
  limit 1;

  if existing_id is not null then
    return query select existing_id, false;
    return;
  end if;

  insert into public.scan_events (
    organization_id, condominium_id, checkpoint_id, worker_id,
    worker_name_snapshot, checkpoint_name_snapshot, ip_address, user_agent,
    latitude, longitude, accuracy_meters, distance_meters, location_status,
    client_scanned_at
  ) values (
    worker_row.organization_id, checkpoint_row.condominium_id,
    checkpoint_row.id, worker_row.id, worker_row.full_name,
    checkpoint_row.name, p_ip_address, left(p_user_agent, 512),
    p_latitude, p_longitude, p_accuracy_meters, p_distance_meters,
    p_location_status, p_client_scanned_at
  ) returning id into existing_id;

  return query select existing_id, true;
end;
$$;

create or replace function public.cleanup_scan_history()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare deleted_count bigint;
begin
  delete from public.scan_events
  where scanned_at < now() - interval '6 months';
  get diagnostics deleted_count = row_count;

  delete from public.auth_rate_limits
  where updated_at < now() - interval '2 days';

  return deleted_count;
end;
$$;

create or replace function public.archive_condominium(
  p_organization_id uuid,
  p_condominium_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.condominiums
  set active = false
  where id = p_condominium_id and organization_id = p_organization_id;

  if not found then raise exception 'condominium_not_found'; end if;

  update public.checkpoints
  set active = false
  where condominium_id = p_condominium_id
    and organization_id = p_organization_id;

  update public.worker_assignments
  set active = false
  where condominium_id = p_condominium_id
    and organization_id = p_organization_id;
end;
$$;

create or replace function public.archive_worker(
  p_organization_id uuid,
  p_worker_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set active = false
  where id = p_worker_id
    and organization_id = p_organization_id
    and role = 'worker';

  if not found then raise exception 'worker_not_found'; end if;

  update public.worker_assignments
  set active = false
  where worker_id = p_worker_id
    and organization_id = p_organization_id;
end;
$$;

alter table public.condominiums enable row level security;
alter table public.worker_assignments enable row level security;
alter table public.checkpoints enable row level security;
alter table public.scan_events enable row level security;

create policy condominiums_read_authorized
on public.condominiums for select to authenticated
using (
  organization_id = (select public.current_profile_organization_id())
  and (
    ((select public.current_profile_role()) = 'master' and (select auth.jwt() ->> 'aal') = 'aal2')
    or exists (
      select 1 from public.worker_assignments wa
      where wa.worker_id = (select auth.uid())
        and wa.condominium_id = condominiums.id and wa.active
    )
  )
);

create policy assignments_read_authorized
on public.worker_assignments for select to authenticated
using (
  organization_id = (select public.current_profile_organization_id())
  and (
    worker_id = (select auth.uid())
    or ((select public.current_profile_role()) = 'master' and (select auth.jwt() ->> 'aal') = 'aal2')
  )
);

create policy checkpoints_read_authorized
on public.checkpoints for select to authenticated
using (
  organization_id = (select public.current_profile_organization_id())
  and (
    ((select public.current_profile_role()) = 'master' and (select auth.jwt() ->> 'aal') = 'aal2')
    or exists (
      select 1 from public.worker_assignments wa
      where wa.worker_id = (select auth.uid())
        and wa.condominium_id = checkpoints.condominium_id and wa.active
    )
  )
);

create policy scans_read_authorized_six_months
on public.scan_events for select to authenticated
using (
  scanned_at >= now() - interval '6 months'
  and organization_id = (select public.current_profile_organization_id())
  and (
    worker_id = (select auth.uid())
    or ((select public.current_profile_role()) = 'master' and (select auth.jwt() ->> 'aal') = 'aal2')
  )
);

revoke all on table public.condominiums from anon, authenticated;
revoke all on table public.worker_assignments from anon, authenticated;
revoke all on table public.checkpoints from anon, authenticated;
revoke all on table public.scan_events from anon, authenticated;
grant select on table public.condominiums to authenticated;
grant select on table public.worker_assignments to authenticated;
grant select on table public.checkpoints to authenticated;
grant select on table public.scan_events to authenticated;

revoke all on function public.record_scan_event(uuid, uuid, inet, text, numeric, numeric, numeric, numeric, public.location_status, timestamptz) from public, anon, authenticated;
revoke all on function public.cleanup_scan_history() from public, anon, authenticated;
revoke all on function public.archive_condominium(uuid, uuid) from public, anon, authenticated;
revoke all on function public.archive_worker(uuid, uuid) from public, anon, authenticated;
grant execute on function public.record_scan_event(uuid, uuid, inet, text, numeric, numeric, numeric, numeric, public.location_status, timestamptz) to service_role;
grant execute on function public.cleanup_scan_history() to service_role;
grant execute on function public.archive_condominium(uuid, uuid) to service_role;
grant execute on function public.archive_worker(uuid, uuid) to service_role;

commit;

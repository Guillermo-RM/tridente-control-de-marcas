-- Secure incident reporting with private evidence, tenant isolation and
-- server-validated worker assignments. Apply after 0010.
begin;

create type public.incident_status as enum ('pending', 'in_progress', 'resolved');

create table public.incident_reports (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  condominium_id uuid not null,
  worker_id uuid not null,
  worker_name_snapshot text not null,
  condominium_name_snapshot text not null,
  incident_type text not null,
  description text not null,
  evidence_path text not null unique,
  evidence_mime_type text not null,
  evidence_size_bytes integer not null,
  latitude numeric(9, 6) not null,
  longitude numeric(9, 6) not null,
  accuracy_meters numeric(10, 2) not null,
  ip_address inet,
  status public.incident_status not null default 'pending',
  status_updated_by uuid references auth.users(id) on delete restrict,
  status_updated_at timestamptz,
  reported_at timestamptz not null default now(),
  constraint incident_reports_condominium_fkey
    foreign key (condominium_id, organization_id)
    references public.condominiums(id, organization_id) on delete restrict,
  constraint incident_reports_worker_fkey
    foreign key (worker_id, organization_id)
    references public.profiles(id, organization_id) on delete restrict,
  constraint incident_type_allowed check (incident_type in (
    'suspicious_person', 'suspicious_vehicle', 'open_access',
    'damage', 'lighting', 'emergency', 'other'
  )),
  constraint incident_description_length check (
    char_length(trim(description)) between 10 and 2000
  ),
  constraint incident_snapshot_limits check (
    char_length(trim(worker_name_snapshot)) between 2 and 120
    and char_length(trim(condominium_name_snapshot)) between 2 and 120
  ),
  constraint incident_evidence_metadata check (
    char_length(evidence_path) between 20 and 500
    and evidence_mime_type in ('image/jpeg', 'image/png', 'image/webp')
    and evidence_size_bytes between 1 and 1572864
  ),
  constraint incident_coordinates_valid check (
    latitude between -90 and 90
    and longitude between -180 and 180
    and accuracy_meters between 0 and 5000
  )
);

create index incident_reports_organization_cursor_idx
  on public.incident_reports (organization_id, reported_at desc, id desc);
create index incident_reports_condominium_cursor_idx
  on public.incident_reports (organization_id, condominium_id, reported_at desc, id desc);
create index incident_reports_worker_cursor_idx
  on public.incident_reports (organization_id, worker_id, reported_at desc, id desc);
create index incident_reports_open_status_idx
  on public.incident_reports (organization_id, status, reported_at desc)
  where status <> 'resolved';

alter table public.incident_reports enable row level security;

create policy incident_reports_read_master_organization
on public.incident_reports for select to authenticated using (
  organization_id = (select public.current_profile_organization_id())
  and (select public.current_profile_role()) = 'master'
);

create or replace function public.record_incident_report(
  p_worker_id uuid,
  p_condominium_id uuid,
  p_incident_type text,
  p_description text,
  p_evidence_path text,
  p_evidence_mime_type text,
  p_evidence_size_bytes integer,
  p_latitude numeric,
  p_longitude numeric,
  p_accuracy_meters numeric,
  p_ip_address inet
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_worker public.profiles%rowtype;
  v_condominium public.condominiums%rowtype;
  v_id uuid;
begin
  if p_incident_type is null or p_incident_type not in (
      'suspicious_person', 'suspicious_vehicle', 'open_access',
      'damage', 'lighting', 'emergency', 'other'
    )
    or char_length(trim(coalesce(p_description, ''))) not between 10 and 2000
    or char_length(coalesce(p_evidence_path, '')) not between 20 and 500
    or p_evidence_mime_type is null
    or p_evidence_mime_type not in ('image/jpeg', 'image/png', 'image/webp')
    or p_evidence_size_bytes is null or p_evidence_size_bytes not between 1 and 1572864
    or p_latitude is null or p_latitude not between -90 and 90
    or p_longitude is null or p_longitude not between -180 and 180
    or p_accuracy_meters is null or p_accuracy_meters not between 0 and 5000 then
    raise exception 'invalid_incident_parameters' using errcode = '22023';
  end if;

  select p.* into v_worker
  from public.profiles p
  join public.organizations o on o.id = p.organization_id
  where p.id = p_worker_id and p.role = 'worker' and p.active and o.active
  for share of p, o;
  if not found then raise exception 'worker_not_allowed'; end if;

  select c.* into v_condominium
  from public.condominiums c
  where c.id = p_condominium_id
    and c.organization_id = v_worker.organization_id
    and c.active
  for share;
  if not found then raise exception 'condominium_not_allowed'; end if;

  perform 1 from public.worker_assignments wa
  where wa.worker_id = v_worker.id
    and wa.condominium_id = v_condominium.id
    and wa.organization_id = v_worker.organization_id
    and wa.active
  for share;
  if not found then raise exception 'assignment_required'; end if;

  insert into public.incident_reports (
    organization_id, condominium_id, worker_id,
    worker_name_snapshot, condominium_name_snapshot,
    incident_type, description, evidence_path, evidence_mime_type,
    evidence_size_bytes, latitude, longitude, accuracy_meters, ip_address
  ) values (
    v_worker.organization_id, v_condominium.id, v_worker.id,
    v_worker.full_name, v_condominium.name,
    p_incident_type, trim(p_description), p_evidence_path, p_evidence_mime_type,
    p_evidence_size_bytes, p_latitude, p_longitude, p_accuracy_meters, p_ip_address
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on table public.incident_reports from public, anon, authenticated, service_role;
grant select on table public.incident_reports to authenticated;
grant select, insert, update on table public.incident_reports to service_role;
revoke all on function public.record_incident_report(
  uuid, uuid, text, text, text, text, integer, numeric, numeric, numeric, inet
) from public, anon, authenticated, service_role;
grant execute on function public.record_incident_report(
  uuid, uuid, text, text, text, text, integer, numeric, numeric, numeric, inet
) to service_role;

-- The browser never accesses evidence directly. The server uses service_role to
-- upload and produces short-lived signed links for authorized masters.
do $$
begin
  if exists (select 1 from pg_catalog.pg_namespace where nspname = 'storage') then
    execute $storage$
      insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      values (
        'incident-evidence', 'incident-evidence', false, 1572864,
        array['image/jpeg', 'image/png', 'image/webp']
      )
      on conflict (id) do update set
        public = false,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types
    $storage$;
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;

-- Per-master unread incident notifications. Apply after 0011.
begin;

alter table public.incident_reports
  add constraint incident_reports_id_organization_unique unique (id, organization_id);

create table public.incident_report_views (
  organization_id uuid not null references public.organizations(id) on delete restrict,
  incident_id uuid not null,
  master_user_id uuid not null,
  viewed_at timestamptz not null default now(),
  primary key (incident_id, master_user_id),
  foreign key (incident_id, organization_id)
    references public.incident_reports(id, organization_id) on delete cascade,
  foreign key (master_user_id, organization_id)
    references public.profiles(id, organization_id) on delete restrict
);

create index incident_report_views_master_idx
  on public.incident_report_views (master_user_id, incident_id);

alter table public.incident_report_views enable row level security;

create or replace function public.count_unread_incident_reports(
  p_master_id uuid,
  p_organization_id uuid
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count bigint;
begin
  perform 1
  from public.profiles p
  join public.organizations o on o.id = p.organization_id
  where p.id = p_master_id
    and p.organization_id = p_organization_id
    and p.role = 'master' and p.active and o.active;
  if not found then raise exception 'master_not_allowed'; end if;

  select count(*) into v_count
  from public.incident_reports ir
  where ir.organization_id = p_organization_id
    and not exists (
      select 1 from public.incident_report_views irv
      where irv.incident_id = ir.id and irv.master_user_id = p_master_id
    );
  return v_count;
end;
$$;

create or replace function public.mark_incident_reports_viewed(
  p_master_id uuid,
  p_organization_id uuid,
  p_incident_ids uuid[]
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count bigint;
begin
  if p_incident_ids is null or cardinality(p_incident_ids) not between 1 and 50 then
    raise exception 'invalid_incident_ids' using errcode = '22023';
  end if;

  perform 1
  from public.profiles p
  join public.organizations o on o.id = p.organization_id
  where p.id = p_master_id
    and p.organization_id = p_organization_id
    and p.role = 'master' and p.active and o.active;
  if not found then raise exception 'master_not_allowed'; end if;

  insert into public.incident_report_views (
    organization_id, incident_id, master_user_id
  )
  select ir.organization_id, ir.id, p_master_id
  from public.incident_reports ir
  where ir.organization_id = p_organization_id
    and ir.id = any(p_incident_ids)
  on conflict (incident_id, master_user_id) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on table public.incident_report_views
  from public, anon, authenticated, service_role;
grant select, insert on table public.incident_report_views to service_role;

revoke all on function public.count_unread_incident_reports(uuid, uuid),
  public.mark_incident_reports_viewed(uuid, uuid, uuid[])
  from public, anon, authenticated, service_role;
grant execute on function public.count_unread_incident_reports(uuid, uuid),
  public.mark_incident_reports_viewed(uuid, uuid, uuid[])
  to service_role;

notify pgrst, 'reload schema';
commit;

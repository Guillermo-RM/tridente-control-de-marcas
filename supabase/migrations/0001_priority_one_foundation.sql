begin;

create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum ('master', 'worker');

create table public.organizations (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index organizations_slug_unique
  on public.organizations (lower(slug));

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  role public.app_role not null,
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  employee_code text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint worker_employee_code_required check (
    role <> 'worker' or nullif(trim(employee_code), '') is not null
  )
);

create unique index profiles_employee_code_per_organization_unique
  on public.profiles (organization_id, lower(employee_code))
  where employee_code is not null;
create index profiles_organization_role_idx
  on public.profiles (organization_id, role)
  where active;

create table public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 3 and 100),
  entity_type text not null check (char_length(entity_type) between 2 and 80),
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index audit_logs_organization_created_idx
  on public.audit_logs (organization_id, created_at desc);
create index audit_logs_actor_created_idx
  on public.audit_logs (actor_user_id, created_at desc);

create table public.auth_rate_limits (
  bucket_key text primary key check (char_length(bucket_key) = 64),
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.current_profile_organization_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.organization_id
  from public.profiles as p
  where p.id = (select auth.uid()) and p.active
$$;

create or replace function public.current_profile_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles as p
  where p.id = (select auth.uid()) and p.active
$$;

create or replace function public.consume_auth_rate_limit(
  p_bucket_key text,
  p_max_attempts integer,
  p_window_seconds integer,
  p_block_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_row public.auth_rate_limits%rowtype;
  current_time timestamptz := clock_timestamp();
  new_count integer;
begin
  if char_length(p_bucket_key) <> 64
    or p_max_attempts < 1
    or p_window_seconds < 1
    or p_block_seconds < 1 then
    raise exception 'invalid rate-limit parameters';
  end if;

  insert into public.auth_rate_limits (bucket_key)
  values (p_bucket_key)
  on conflict (bucket_key) do nothing;

  select * into current_row
  from public.auth_rate_limits
  where bucket_key = p_bucket_key
  for update;

  if current_row.blocked_until is not null
    and current_row.blocked_until > current_time then
    return false;
  end if;

  if current_row.window_started_at
    <= current_time - make_interval(secs => p_window_seconds) then
    current_row.window_started_at := current_time;
    current_row.attempt_count := 0;
  end if;

  new_count := current_row.attempt_count + 1;

  if new_count >= p_max_attempts then
    update public.auth_rate_limits
    set attempt_count = new_count,
        window_started_at = current_row.window_started_at,
        blocked_until = current_time + make_interval(secs => p_block_seconds),
        updated_at = current_time
    where bucket_key = p_bucket_key;
    return false;
  end if;

  update public.auth_rate_limits
  set attempt_count = new_count,
      window_started_at = current_row.window_started_at,
      blocked_until = null,
      updated_at = current_time
  where bucket_key = p_bucket_key;
  return true;
end;
$$;

create or replace function public.clear_auth_rate_limit(p_bucket_key text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.auth_rate_limits where bucket_key = p_bucket_key
$$;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.audit_logs enable row level security;
alter table public.auth_rate_limits enable row level security;

create policy organizations_read_own
on public.organizations
for select
to authenticated
using (
  active
  and id = (select public.current_profile_organization_id())
);

create policy profiles_read_self_or_master_organization
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or (
    organization_id = (select public.current_profile_organization_id())
    and (select public.current_profile_role()) = 'master'
    and (select auth.jwt() ->> 'aal') = 'aal2'
  )
);

create policy audit_logs_read_master_organization
on public.audit_logs
for select
to authenticated
using (
  organization_id = (select public.current_profile_organization_id())
  and (select public.current_profile_role()) = 'master'
  and (select auth.jwt() ->> 'aal') = 'aal2'
);

revoke all on table public.organizations from anon, authenticated;
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.audit_logs from anon, authenticated;
revoke all on table public.auth_rate_limits from anon, authenticated;
grant select on table public.organizations to authenticated;
grant select on table public.profiles to authenticated;
grant select on table public.audit_logs to authenticated;

revoke all on function public.consume_auth_rate_limit(text, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.clear_auth_rate_limit(text) from public, anon, authenticated;
revoke all on function public.current_profile_organization_id() from public, anon;
revoke all on function public.current_profile_role() from public, anon;
revoke all on function public.set_updated_at() from public, anon, authenticated;
grant execute on function public.consume_auth_rate_limit(text, integer, integer, integer) to service_role;
grant execute on function public.clear_auth_rate_limit(text) to service_role;
grant execute on function public.current_profile_organization_id() to authenticated;
grant execute on function public.current_profile_role() to authenticated;

commit;

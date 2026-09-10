-- Apply after 0001, 0002 and 0003. Existing invalid data aborts this entire
-- transaction; it is never silently deleted or repaired.
begin;

-- BYPASSRLS does not bypass table privileges. The backend may read reports,
-- append audit entries and call controlled RPCs, but not rewrite scan history.
revoke all on table public.organizations, public.profiles,
  public.condominiums, public.worker_assignments, public.checkpoints,
  public.scan_events, public.audit_logs, public.auth_rate_limits
  from public, anon, authenticated, service_role;
grant select on table public.organizations, public.profiles,
  public.condominiums, public.worker_assignments, public.checkpoints,
  public.scan_events, public.audit_logs to authenticated;
grant select, insert, update, delete on table public.organizations,
  public.profiles, public.condominiums, public.worker_assignments,
  public.checkpoints to service_role;
grant select on table public.scan_events to service_role;
grant select, insert on table public.audit_logs to service_role;
revoke all on sequence public.audit_logs_id_seq
  from public, anon, authenticated, service_role;
grant usage on sequence public.audit_logs_id_seq to service_role;

-- Only the migration owner may create objects in this API schema.
revoke create on schema public from public, anon, authenticated, service_role;
-- These defaults apply to future objects created by this migration's owner.
-- Other migration owners must configure their own default privileges too.
-- PUBLIC's built-in EXECUTE default is global, not schema-specific.
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke all on tables
  from public, anon, authenticated, service_role;
alter default privileges in schema public revoke all on sequences
  from public, anon, authenticated, service_role;
alter default privileges in schema public revoke execute on functions
  from public, anon, authenticated, service_role;

-- A CHECK evaluating to NULL passes in PostgreSQL: require both coordinates.
alter table public.condominiums drop constraint condominium_coordinates_together;
alter table public.condominiums add constraint condominium_coordinates_together check (
  (latitude is null and longitude is null) or
  (latitude is not null and longitude is not null
   and latitude between -90 and 90 and longitude between -180 and 180)
);
alter table public.checkpoints drop constraint checkpoint_coordinates_together;
alter table public.checkpoints add constraint checkpoint_coordinates_together check (
  (latitude is null and longitude is null) or
  (latitude is not null and longitude is not null
   and latitude between -90 and 90 and longitude between -180 and 180)
);
alter table public.scan_events drop constraint scan_coordinates_together;
alter table public.scan_events add constraint scan_coordinates_together check (
  (latitude is null and longitude is null) or
  (latitude is not null and longitude is not null
   and latitude between -90 and 90 and longitude between -180 and 180)
);
alter table public.scan_events drop constraint scan_accuracy_positive;
alter table public.scan_events add constraint scan_accuracy_positive
  check (accuracy_meters is null or accuracy_meters between 0 and 1000000);
alter table public.scan_events add constraint scan_distance_valid
  check (distance_meters is null or distance_meters between 0 and 21000000);
alter table public.scan_events add constraint scan_snapshot_limits check (
  char_length(trim(worker_name_snapshot)) between 2 and 120
  and char_length(trim(checkpoint_name_snapshot)) between 2 and 120
  and (user_agent is null or char_length(user_agent) <= 512)
);

-- Replace (do not duplicate) foreign keys to preserve PostgREST relationships.
alter table public.checkpoints add constraint checkpoints_identity_unique
  unique (id, condominium_id, organization_id);
alter table public.scan_events
  drop constraint scan_events_condominium_id_fkey,
  drop constraint scan_events_checkpoint_id_fkey,
  drop constraint scan_events_worker_id_fkey;
alter table public.scan_events
  add constraint scan_events_condominium_id_fkey
    foreign key (condominium_id, organization_id)
    references public.condominiums(id, organization_id) on delete restrict,
  add constraint scan_events_checkpoint_id_fkey
    foreign key (checkpoint_id, condominium_id, organization_id)
    references public.checkpoints(id, condominium_id, organization_id) on delete restrict,
  add constraint scan_events_worker_id_fkey
    foreign key (worker_id, organization_id)
    references public.profiles(id, organization_id) on delete restrict;

create or replace function public.current_profile_organization_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select p.organization_id from public.profiles p
  join public.organizations o on o.id = p.organization_id
  where p.id = (select auth.uid()) and p.active and o.active
$$;
create or replace function public.current_profile_role()
returns public.app_role language sql stable security definer set search_path = '' as $$
  select p.role from public.profiles p
  join public.organizations o on o.id = p.organization_id
  where p.id = (select auth.uid()) and p.active and o.active
$$;

-- Self-read at AAL1 remains necessary to enroll/complete master MFA.
drop policy profiles_read_self_or_master_organization on public.profiles;
create policy profiles_read_self_or_master_organization
on public.profiles for select to authenticated using (
  organization_id = (select public.current_profile_organization_id())
  and (id = (select auth.uid()) or (
    (select public.current_profile_role()) = 'master'
    and (select auth.jwt() ->> 'aal') = 'aal2'
  ))
);

create or replace function public.consume_auth_rate_limit(
  p_bucket_key text, p_max_attempts integer,
  p_window_seconds integer, p_block_seconds integer
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_row public.auth_rate_limits%rowtype;
  v_now timestamptz;
begin
  if p_bucket_key is null or p_bucket_key !~ '^[a-f0-9]{64}$'
    or p_max_attempts is null or p_max_attempts not between 1 and 10000
    or p_window_seconds is null or p_window_seconds not between 1 and 86400
    or p_block_seconds is null or p_block_seconds not between 1 and 86400 then
    raise exception 'invalid_rate_limit_parameters' using errcode = '22023';
  end if;
  insert into public.auth_rate_limits(bucket_key) values (p_bucket_key)
    on conflict (bucket_key) do nothing;
  select * into v_row from public.auth_rate_limits
    where bucket_key = p_bucket_key for update;
  v_now := clock_timestamp();
  if v_row.blocked_until > v_now then return false; end if;
  if v_row.window_started_at <= v_now - make_interval(secs => p_window_seconds)
    or v_row.blocked_until <= v_now then
    v_row.window_started_at := v_now;
    v_row.attempt_count := 0;
  end if;
  -- Allow exactly p_max_attempts, then block the next request.
  update public.auth_rate_limits set
    attempt_count = least(v_row.attempt_count + 1, p_max_attempts + 1),
    window_started_at = v_row.window_started_at,
    blocked_until = case when v_row.attempt_count >= p_max_attempts
      then v_now + make_interval(secs => p_block_seconds) else null end,
    updated_at = v_now
  where bucket_key = p_bucket_key;
  return v_row.attempt_count < p_max_attempts;
end;
$$;

create or replace function public.record_scan_event(
  p_worker_id uuid, p_checkpoint_id uuid, p_ip_address inet, p_user_agent text,
  p_latitude numeric, p_longitude numeric, p_accuracy_meters numeric,
  p_distance_meters numeric, p_location_status public.location_status,
  p_client_scanned_at timestamptz
)
returns table(scan_id uuid, created boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_worker public.profiles%rowtype;
  v_checkpoint public.checkpoints%rowtype;
  v_id uuid;
  v_a double precision;
  v_distance numeric;
  v_status public.location_status := 'unavailable';
begin
  if (p_latitude is null) <> (p_longitude is null)
    or (p_latitude is not null and not (p_latitude between -90 and 90))
    or (p_longitude is not null and not (p_longitude between -180 and 180))
    or (p_accuracy_meters is not null and not (p_accuracy_meters between 0 and 1000000))
    or (p_client_scanned_at is not null and not isfinite(p_client_scanned_at)) then
    raise exception 'invalid_scan_parameters' using errcode = '22023';
  end if;
  select p.* into v_worker from public.profiles p
    join public.organizations o on o.id = p.organization_id
    where p.id = p_worker_id and p.role = 'worker' and p.active and o.active
    for share of p, o;
  if not found then raise exception 'worker_not_allowed'; end if;
  select cp.* into v_checkpoint from public.checkpoints cp
    join public.condominiums c on c.id = cp.condominium_id
    where cp.id = p_checkpoint_id and cp.active and c.active
      and cp.organization_id = v_worker.organization_id
    for share of cp, c;
  if not found then raise exception 'checkpoint_not_allowed'; end if;
  perform 1 from public.worker_assignments wa
    where wa.worker_id = p_worker_id
      and wa.condominium_id = v_checkpoint.condominium_id
      and wa.organization_id = v_worker.organization_id and wa.active
    for share;
  if not found then raise exception 'assignment_required'; end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_worker_id::text || p_checkpoint_id::text, 0));
  select se.id into v_id from public.scan_events se
    where se.worker_id = p_worker_id and se.checkpoint_id = p_checkpoint_id
      and se.scanned_at > clock_timestamp() - interval '60 seconds'
    order by se.scanned_at desc limit 1;
  if v_id is not null then
    return query select v_id, false;
    return;
  end if;
  -- Keep RPC arguments compatible, but never trust supplied distance/status.
  -- GPS itself is client evidence, NOT proof of physical presence.
  if p_latitude is not null and v_checkpoint.latitude is not null then
    v_a := power(sin(radians((p_latitude - v_checkpoint.latitude)::double precision) / 2), 2)
      + cos(radians(v_checkpoint.latitude::double precision))
      * cos(radians(p_latitude::double precision))
      * power(sin(radians((p_longitude - v_checkpoint.longitude)::double precision) / 2), 2);
    v_a := greatest(0::double precision, least(1::double precision, v_a));
    v_distance := (6371000 * 2 * atan2(sqrt(v_a), sqrt(1 - v_a)))::numeric;
    v_status := case when v_distance <= v_checkpoint.radius_meters
      + least(coalesce(p_accuracy_meters, 0), 100)
      then 'verified'::public.location_status else 'outside'::public.location_status end;
  end if;
  insert into public.scan_events (
    organization_id, condominium_id, checkpoint_id, worker_id,
    worker_name_snapshot, checkpoint_name_snapshot, ip_address, user_agent,
    latitude, longitude, accuracy_meters, distance_meters, location_status,
    client_scanned_at, scanned_at
  ) values (
    v_worker.organization_id, v_checkpoint.condominium_id, v_checkpoint.id,
    v_worker.id, v_worker.full_name, v_checkpoint.name, p_ip_address,
    left(p_user_agent, 512), p_latitude, p_longitude, p_accuracy_meters,
    round(v_distance, 2), v_status, p_client_scanned_at, clock_timestamp()
  ) returning id into v_id;
  return query select v_id, true;
end;
$$;

-- Explicit ACLs also protect installations with permissive Supabase defaults.
revoke all on function public.current_profile_organization_id(),
  public.current_profile_role() from public, anon, authenticated, service_role;
grant execute on function public.current_profile_organization_id(),
  public.current_profile_role() to authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated, service_role;
revoke all on function public.consume_auth_rate_limit(text, integer, integer, integer),
  public.clear_auth_rate_limit(text), public.cleanup_scan_history(),
  public.archive_condominium(uuid, uuid), public.archive_worker(uuid, uuid),
  public.record_scan_event(uuid, uuid, inet, text, numeric, numeric, numeric, numeric, public.location_status, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.consume_auth_rate_limit(text, integer, integer, integer),
  public.clear_auth_rate_limit(text), public.cleanup_scan_history(),
  public.archive_condominium(uuid, uuid), public.archive_worker(uuid, uuid),
  public.record_scan_event(uuid, uuid, inet, text, numeric, numeric, numeric, numeric, public.location_status, timestamptz)
  to service_role;

notify pgrst, 'reload schema';
commit;

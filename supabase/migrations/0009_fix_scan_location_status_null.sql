-- Preserve the default "unavailable" status when no duplicate scan exists.
-- Apply after 0008_master_only_scan_history.sql.
begin;

create or replace function public.record_scan_event(
  p_worker_id uuid,
  p_checkpoint_id uuid,
  p_ip_address inet,
  p_latitude numeric,
  p_longitude numeric,
  p_accuracy_meters numeric
)
returns table(scan_id uuid, created boolean, scan_location_status public.location_status)
language plpgsql security definer set search_path = '' as $$
declare
  v_worker public.profiles%rowtype;
  v_checkpoint public.checkpoints%rowtype;
  v_id uuid;
  v_existing_status public.location_status;
  v_a double precision;
  v_distance numeric;
  v_status public.location_status := 'unavailable';
  v_now timestamptz := clock_timestamp();
begin
  if (p_latitude is null) <> (p_longitude is null)
    or (p_latitude is not null and not (p_latitude between -90 and 90))
    or (p_longitude is not null and not (p_longitude between -180 and 180))
    or (p_accuracy_meters is not null and not (p_accuracy_meters between 0 and 1000000)) then
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

  delete from public.scan_events
  where worker_id = p_worker_id
    and scanned_at < v_now - interval '6 months';

  select se.id, se.location_status into v_id, v_existing_status
  from public.scan_events se
  where se.worker_id = p_worker_id and se.checkpoint_id = p_checkpoint_id
    and se.scanned_at > v_now - interval '60 seconds'
  order by se.scanned_at desc limit 1;
  if v_id is not null then
    return query select v_id, false, v_existing_status;
    return;
  end if;

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
    worker_name_snapshot, checkpoint_name_snapshot, ip_address,
    latitude, longitude, accuracy_meters, distance_meters,
    location_status, scanned_at
  ) values (
    v_worker.organization_id, v_checkpoint.condominium_id, v_checkpoint.id,
    v_worker.id, v_worker.full_name, v_checkpoint.name, p_ip_address,
    p_latitude, p_longitude, p_accuracy_meters, round(v_distance, 2),
    v_status, v_now
  ) returning id, location_status into v_id, v_status;

  return query select v_id, true, v_status;
end;
$$;

revoke all on function public.record_scan_event(
  uuid, uuid, inet, numeric, numeric, numeric
) from public, anon, authenticated, service_role;
grant execute on function public.record_scan_event(
  uuid, uuid, inet, numeric, numeric, numeric
) to service_role;

notify pgrst, 'reload schema';
commit;

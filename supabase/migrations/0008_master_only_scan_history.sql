-- Workers may create scan events through the protected server RPC, but only
-- masters may read scan history. Apply after 0007.
begin;

drop policy if exists scans_read_authorized_six_months on public.scan_events;
drop policy if exists scans_read_master_six_months on public.scan_events;

create policy scans_read_master_six_months
on public.scan_events for select to authenticated using (
  scanned_at >= now() - interval '6 months'
  and organization_id = (select public.current_profile_organization_id())
  and (select public.current_profile_role()) = 'master'
);

notify pgrst, 'reload schema';
commit;

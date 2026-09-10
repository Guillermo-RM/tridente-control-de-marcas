-- The client chose password-only authentication. Apply after migration 0004.
-- This removes AAL2 checks but preserves authentication, role checks,
-- organization isolation, RLS, rate limiting and audit logging.
begin;

drop policy profiles_read_self_or_master_organization on public.profiles;
create policy profiles_read_self_or_master_organization
on public.profiles for select to authenticated using (
  organization_id = (select public.current_profile_organization_id())
  and (
    id = (select auth.uid())
    or (select public.current_profile_role()) = 'master'
  )
);

drop policy audit_logs_read_master_organization on public.audit_logs;
create policy audit_logs_read_master_organization
on public.audit_logs for select to authenticated using (
  organization_id = (select public.current_profile_organization_id())
  and (select public.current_profile_role()) = 'master'
);

drop policy condominiums_read_authorized on public.condominiums;
create policy condominiums_read_authorized
on public.condominiums for select to authenticated using (
  organization_id = (select public.current_profile_organization_id())
  and (
    (select public.current_profile_role()) = 'master'
    or exists (
      select 1 from public.worker_assignments wa
      where wa.worker_id = (select auth.uid())
        and wa.condominium_id = condominiums.id
        and wa.active
    )
  )
);

drop policy assignments_read_authorized on public.worker_assignments;
create policy assignments_read_authorized
on public.worker_assignments for select to authenticated using (
  organization_id = (select public.current_profile_organization_id())
  and (
    worker_id = (select auth.uid())
    or (select public.current_profile_role()) = 'master'
  )
);

drop policy checkpoints_read_authorized on public.checkpoints;
create policy checkpoints_read_authorized
on public.checkpoints for select to authenticated using (
  organization_id = (select public.current_profile_organization_id())
  and (
    (select public.current_profile_role()) = 'master'
    or exists (
      select 1 from public.worker_assignments wa
      where wa.worker_id = (select auth.uid())
        and wa.condominium_id = checkpoints.condominium_id
        and wa.active
    )
  )
);

drop policy scans_read_authorized_six_months on public.scan_events;
create policy scans_read_authorized_six_months
on public.scan_events for select to authenticated using (
  scanned_at >= now() - interval '6 months'
  and organization_id = (select public.current_profile_organization_id())
  and (
    worker_id = (select auth.uid())
    or (select public.current_profile_role()) = 'master'
  )
);

notify pgrst, 'reload schema';
commit;

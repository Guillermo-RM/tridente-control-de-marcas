begin;

drop index if exists public.profiles_email_per_organization_unique;

update public.audit_logs
set before_data = before_data - 'email',
    after_data = after_data - 'email'
where before_data ? 'email' or after_data ? 'email';

alter table public.profiles drop column if exists email;

commit;

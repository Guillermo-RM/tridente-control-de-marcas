begin;

alter table public.profiles add column nickname text;

-- Preserve existing accounts with deterministic, globally unique nicknames.
-- Administrators can replace these values after migration.
update public.profiles
set nickname = 'u_' || substr(replace(id::text, '-', ''), 1, 30);

alter table public.profiles alter column nickname set not null;
alter table public.profiles add constraint profiles_nickname_format
  check (nickname ~ '^[a-z0-9][a-z0-9._-]{2,31}$');
create unique index profiles_nickname_unique on public.profiles (lower(nickname));

comment on column public.profiles.nickname is
  'Global login identifier, lowercase; reserved even when the account is archived.';

commit;

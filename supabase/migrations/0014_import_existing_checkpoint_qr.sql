begin;

create table public.checkpoint_imported_tokens (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  checkpoint_id uuid not null references public.checkpoints(id) on delete restrict,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (checkpoint_id)
);

alter table public.checkpoint_imported_tokens enable row level security;
revoke all on table public.checkpoint_imported_tokens from public, anon, authenticated, service_role;
grant select, insert, delete on table public.checkpoint_imported_tokens to service_role;
revoke all on sequence public.checkpoint_imported_tokens_id_seq from public, anon, authenticated, service_role;
grant usage, select on sequence public.checkpoint_imported_tokens_id_seq to service_role;

commit;


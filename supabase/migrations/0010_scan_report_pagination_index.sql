begin;

-- Sustenta la consulta paginada por condominio sin recorrer todo el histórico.
create index if not exists scan_events_condominium_cursor_idx
  on public.scan_events (
    organization_id,
    condominium_id,
    scanned_at desc,
    id desc
  );

commit;

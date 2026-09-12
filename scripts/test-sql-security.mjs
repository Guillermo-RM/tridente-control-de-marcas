// Usage: node scripts/test-sql-security.mjs <absolute-path-to-pglite/dist/index.js>
// Disposable embedded PostgreSQL; never connects to Supabase or reads .env.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

if (!process.argv[2]) throw new Error('Provide the installed PGlite module path');
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const db = new PGlite();
let passed = 0;
const check = async (name, fn) => {
  await fn();
  passed++;
  console.log(`PASS ${name}`);
};
const deny = async (sql, code) => assert.rejects(db.exec(sql), (e) => e.code === code);
const scalar = async (sql) => Object.values((await db.query(sql)).rows[0])[0];
const orgA = '10000000-0000-4000-8000-000000000001';
const orgB = '10000000-0000-4000-8000-000000000002';
const master = '20000000-0000-4000-8000-000000000001';
const worker = '20000000-0000-4000-8000-000000000002';
const other = '20000000-0000-4000-8000-000000000003';
const condo = '30000000-0000-4000-8000-000000000001';
const condoB = '30000000-0000-4000-8000-000000000002';
const cp = '40000000-0000-4000-8000-000000000001';
const cpB = '40000000-0000-4000-8000-000000000002';
const cpWithoutLocation = '40000000-0000-4000-8000-000000000003';
const login = async (id, aal = 'aal1') => {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify({ sub: id, aal })]);
  await db.exec('set role authenticated');
};
const scan = (lat = '0', lon = '0', checkpoint = cp) =>
  `select * from public.record_scan_event('${worker}', '${checkpoint}', '127.0.0.1', ${lat}, ${lon}, 1)`;

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema extensions;
    create table auth.users(id uuid primary key);
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as
      $$ select (auth.jwt()->>'sub')::uuid $$;
    grant usage on schema auth, public to anon, authenticated, service_role;
    -- PGlite has no pgcrypto extension; UUID compatibility shim for migration 1.
    create function extensions.gen_random_uuid() returns uuid language sql as
      $$ select pg_catalog.gen_random_uuid() $$;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  `);
  for (const name of ['0001_priority_one_foundation', '0002_operations', '0003_nickname_login', '0004_security_hardening', '0005_remove_master_mfa_requirement', '0006_remove_worker_recovery_email', '0007_lightweight_scan_retention', '0008_master_only_scan_history', '0009_fix_scan_location_status_null', '0010_scan_report_pagination_index', '0011_secure_incident_reporting', '0012_incident_unread_notifications']) {
    let sql = await readFile(new URL(`../supabase/migrations/${name}.sql`, import.meta.url), 'utf8');
    sql = sql.replace('create extension if not exists pgcrypto with schema extensions;', '-- pgcrypto UUID shim installed above');
    await db.exec(sql);
    console.log(`APPLIED ${name}`);
  }
  await db.exec(`
    insert into auth.users values ('${master}'), ('${worker}'), ('${other}');
    insert into public.organizations(id,name,slug) values ('${orgA}','Organization A','org-a'), ('${orgB}','Organization B','org-b');
    insert into public.profiles(id,organization_id,role,full_name,employee_code,nickname) values
      ('${master}','${orgA}','master','Master A',null,'master-a'),
      ('${worker}','${orgA}','worker','Worker A','001','worker-a'),
      ('${other}','${orgB}','worker','Worker B','001','worker-b');
    insert into public.condominiums(id,organization_id,name,address,created_by) values
      ('${condo}','${orgA}','Condo A','Address A','${master}'),
      ('${condoB}','${orgB}','Condo B','Address B','${other}');
    insert into public.checkpoints(id,organization_id,condominium_id,name,latitude,longitude,created_by) values
      ('${cp}','${orgA}','${condo}','Checkpoint A',10,10,'${master}'),
      ('${cpWithoutLocation}','${orgA}','${condo}','Checkpoint Without Location',null,null,'${master}'),
      ('${cpB}','${orgB}','${condoB}','Checkpoint B',0,0,'${other}');
    insert into public.worker_assignments(organization_id,worker_id,condominium_id,assigned_by)
      values ('${orgA}','${worker}','${condo}','${master}');
  `);
  await check('anonymous cannot read profiles or call privileged RPC', async () => {
    await db.exec('set role anon');
    await deny('select * from public.profiles', '42501');
    await deny(scan(), '42501');
  });
  await check('worker sees only own profile and assigned condominium', async () => {
    await login(worker);
    assert.equal(await scalar('select count(*)::int from public.profiles'), 1);
    assert.equal(await scalar('select id::text from public.condominiums'), condo);
    await deny("update public.profiles set role = 'master'", '42501');
    await deny(scan(), '42501');
  });
  await check('master has organization-wide reads without MFA', async () => {
    await login(master);
    assert.equal(await scalar('select count(*)::int from public.profiles'), 2);
    assert.equal(await scalar('select count(*)::int from public.condominiums'), 1);
    assert.equal(await scalar(`select count(*)::int from pg_policies
      where schemaname='public' and coalesce(qual, '') like '%jwt%'`), 0);
  });
  await check('inactive organization blocks authenticated reads', async () => {
    await db.exec(`reset role; update public.organizations set active=false where id='${orgA}'`);
    await login(worker);
    assert.equal(await scalar('select count(*)::int from public.profiles'), 0);
    assert.equal(await scalar('select count(*)::int from public.checkpoints'), 0);
    await db.exec(`reset role; update public.organizations set active=true where id='${orgA}'`);
  });
  await check('coordinate checks reject incomplete pairs', async () => {
    await deny(`update public.checkpoints set longitude=null where id='${cp}'`, '23514');
    await deny(`update public.condominiums set latitude=10 where id='${condo}'`, '23514');
  });
  await check('backend cannot overwrite history, audit, or rate-limit storage', async () => {
    await db.exec('set role service_role');
    for (const sql of ['delete from public.scan_events', 'update public.scan_events set worker_name_snapshot = \'changed\'', 'truncate public.scan_events', 'delete from public.audit_logs', 'update public.audit_logs set action=\'changed\'', 'truncate public.audit_logs', 'select * from public.auth_rate_limits']) await deny(sql, '42501');
    await db.exec(`insert into public.audit_logs(organization_id,actor_user_id,action,entity_type) values ('${orgA}','${master}','security.test','test')`);
  });
  await check('rate limiter rejects NULL and permits exactly the configured attempts', async () => {
    await deny("select public.consume_auth_rate_limit(null, 2, 60, 60)", '22023');
    await deny("select public.consume_auth_rate_limit(repeat('a',64), null, 60, 60)", '22023');
    assert.equal(await scalar("select public.consume_auth_rate_limit(repeat('a',64), 2, 60, 60)"), true);
    assert.equal(await scalar("select public.consume_auth_rate_limit(repeat('a',64), 2, 60, 60)"), true);
    assert.equal(await scalar("select public.consume_auth_rate_limit(repeat('a',64), 2, 60, 60)"), false);
  });
  await check('RPC rejects cross-organization checkpoints and partial GPS', async () => {
    await deny(scan('0', '0', cpB), 'P0001');
    await deny(scan('0', 'null'), '22023');
    await deny(scan("'NaN'::numeric", '0'), '22023');
  });
  await check('RPC computes distance/status and deduplicates scans', async () => {
    assert.equal((await db.query(scan())).rows[0].created, true);
    assert.equal(await scalar('select location_status from public.scan_events'), 'outside');
    assert.equal((await db.query(scan())).rows[0].created, false);
    assert.equal(await scalar('select count(*)::int from public.scan_events'), 1);
  });
  await check('RPC stores unavailable status when checkpoint has no location', async () => {
    const result = await db.query(scan('null', 'null', cpWithoutLocation));
    assert.equal(result.rows[0].created, true);
    assert.equal(result.rows[0].scan_location_status, 'unavailable');
  });
  await check('workers cannot read scan history while masters retain access', async () => {
    await login(worker);
    assert.equal(await scalar('select count(*)::int from public.scan_events'), 0);
    await login(master);
    assert.equal(await scalar('select count(*)::int from public.scan_events'), 2);
  });
  await check('incident RPC validates assignment and hides history from workers', async () => {
    await db.exec('reset role; set role service_role');
    const incidentId = await scalar(`select public.record_incident_report(
      '${worker}', '${condo}', 'damage', 'Broken lamp beside the north entrance',
      '${orgA}/${worker}/evidence.jpg', 'image/jpeg', 12000, 10, 10, 8, '127.0.0.1'
    )::text`);
    assert.match(incidentId, /^[0-9a-f-]{36}$/);
    await deny(`select public.record_incident_report(
      '${worker}', '${condoB}', 'damage', 'Cross organization incident attempt',
      '${orgA}/${worker}/other.jpg', 'image/jpeg', 12000, 10, 10, 8, '127.0.0.1'
    )`, 'P0001');
    await login(worker);
    assert.equal(await scalar('select count(*)::int from public.incident_reports'), 0);
    await deny(`select public.record_incident_report(
      '${worker}', '${condo}', 'damage', 'Direct worker RPC attempt is blocked',
      '${orgA}/${worker}/blocked.jpg', 'image/jpeg', 12000, 10, 10, 8, '127.0.0.1'
    )`, '42501');
    await login(master);
    assert.equal(await scalar('select count(*)::int from public.incident_reports'), 1);
  });
  await check('unread incident notifications are private to each master', async () => {
    await db.exec('reset role; set role service_role');
    assert.equal(Number(await scalar(`select public.count_unread_incident_reports('${master}', '${orgA}')`)), 1);
    const incidentId = await scalar('select id::text from public.incident_reports limit 1');
    assert.equal(Number(await scalar(`select public.mark_incident_reports_viewed(
      '${master}', '${orgA}', array['${incidentId}'::uuid]
    )`)), 1);
    assert.equal(Number(await scalar(`select public.count_unread_incident_reports('${master}', '${orgA}')`)), 0);
    await login(worker);
    await deny('select count(*)::int from public.incident_report_views', '42501');
    await deny(`select public.count_unread_incident_reports('${master}', '${orgA}')`, '42501');
  });
  await check('composite foreign keys reject cross-tenant historical relationships', async () => {
    await db.exec('reset role');
    await deny(`update public.scan_events set worker_id='${other}'`, '23503');
    await deny(`update public.scan_events set checkpoint_id='${cpB}'`, '23503');
  });
  await check('inactive worker cannot scan or read with an existing session', async () => {
    await db.exec(`update public.profiles set active=false where id='${worker}'; set role service_role`);
    await deny(scan(), 'P0001');
    await login(worker);
    assert.equal(await scalar('select count(*)::int from public.scan_events'), 0);
    await db.exec(`reset role; update public.profiles set active=true where id='${worker}'`);
  });
  await check('future functions are not implicitly public', async () => {
    await db.exec('create function public.security_probe() returns int language sql as $$ select 1 $$');
    assert.equal(await scalar("select has_function_privilege('anon','public.security_probe()','EXECUTE')"), false);
    assert.equal(await scalar("select has_function_privilege('authenticated','public.security_probe()','EXECUTE')"), false);
  });
  await check('all application tables retain RLS and privileged functions have fixed search paths', async () => {
    assert.equal(await scalar(`select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname in ('organizations','profiles','condominiums','worker_assignments','checkpoints','scan_events','incident_reports','incident_report_views','audit_logs','auth_rate_limits') and c.relrowsecurity`), 10);
    assert.equal(await scalar(`select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.prosecdef and not coalesce(p.proconfig @> array['search_path=""'], false)`), 0);
    for (const signature of ['cleanup_scan_history()', 'record_scan_event(uuid,uuid,inet,numeric,numeric,numeric)', 'record_incident_report(uuid,uuid,text,text,text,text,integer,numeric,numeric,numeric,inet)', 'count_unread_incident_reports(uuid,uuid)', 'mark_incident_reports_viewed(uuid,uuid,uuid[])', 'archive_worker(uuid,uuid)', 'archive_condominium(uuid,uuid)', 'clear_auth_rate_limit(text)']) {
      for (const role of ['anon', 'authenticated']) {
        assert.equal(await scalar(`select has_function_privilege('${role}','public.${signature}','EXECUTE')`), false);
      }
    }
  });
  await check('revoked assignment and inactive organization block scan RPC', async () => {
    await db.exec(`update public.worker_assignments set active=false; set role service_role`);
    await deny(scan(), 'P0001');
    await db.exec(`reset role; update public.worker_assignments set active=true;
      update public.organizations set active=false where id='${orgA}'; set role service_role`);
    await deny(scan(), 'P0001');
    await db.exec(`reset role; update public.organizations set active=true where id='${orgA}'`);
  });
  await check('new scans and scheduled cleanup enforce six-month retention', async () => {
    assert.equal(await scalar(`select count(*)::int from information_schema.columns
      where table_schema='public' and table_name='scan_events'
      and column_name in ('user_agent','client_scanned_at')`), 0);
    await db.exec(`update public.scan_events set scanned_at=now()-interval '7 months'; set role service_role`);
    await db.query(scan());
    await login(worker);
    assert.equal(await scalar('select count(*)::int from public.scan_events'), 0);
    await login(master);
    assert.equal(await scalar('select count(*)::int from public.scan_events'), 1);
    await deny('select public.cleanup_scan_history()', '42501');
    await db.exec(`reset role;
      insert into public.scan_events(
        organization_id, condominium_id, checkpoint_id, worker_id,
        worker_name_snapshot, checkpoint_name_snapshot, location_status, scanned_at
      ) values (
        '${orgB}', '${condoB}', '${cpB}', '${other}',
        'Worker B', 'Checkpoint B', 'unavailable', now()-interval '7 months'
      );
      set role service_role`);
    assert.equal(Number(await scalar('select public.cleanup_scan_history()')), 1);
    assert.equal(await scalar('select count(*)::int from public.scan_events'), 1);
    assert.equal(await scalar('select count(*)::int from public.audit_logs'), 1);
  });
  await check('condominium report cursor index is installed', async () => {
    assert.equal(await scalar(`select count(*)::int from pg_indexes
      where schemaname='public'
      and tablename='scan_events'
      and indexname='scan_events_condominium_cursor_idx'`), 1);
  });
  console.log(`${passed} SQL security checks passed (embedded PostgreSQL; mocked Supabase Auth).`);
} finally {
  await db.close();
}

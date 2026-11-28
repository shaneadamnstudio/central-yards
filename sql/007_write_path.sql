-- 007: writes move server-side, so anon holds no UPDATE at all.
--
-- Supersedes the write half of 004 on an existing database.
--
-- Why
--   The browser used to write task status and activation dates with the
--   publishable key, which meant anon needed two column-level UPDATE grants and
--   two RLS policies to make a tick land. That had two costs:
--
--     * the policies carried `using (visibility = 'shared')`, so an internal
--       task was read-only to everybody, including the studio that owns it
--     * the public key could still change the status of any row it could see,
--       which is a write path sitting in the browser
--
--   Writes now go through /api/state, which runs server-side with the service
--   key and enforces the caller's scope per row in lib/store.js. So the
--   database does not need to grant anon anything but SELECT.
--
-- End state: anon is read-only on every table. `authenticated` and
-- `service_role` are untouched.
--
-- Idempotent: safe to run again. Prints a privilege summary at the end.
--
-- Order matters: apply this AFTER the deployment that moves the write path.
-- Applying it first breaks ticking on the old build until the new one ships.

begin;

revoke update (status) on public.tasks from anon;
revoke update (start_date, end_date) on public.activations from anon;

-- the grants are gone, so the policies would be inert; drop them rather than
-- leave a control that reads as if it were doing something
drop policy if exists tasks_anon_update on public.tasks;
drop policy if exists activations_anon_update on public.activations;

-- status must land in the app's vocabulary whatever writes it. The service key
-- bypasses RLS but not a check constraint.
alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks add constraint tasks_status_check
  check (status in ('open', 'doing', 'blocked', 'done'));

commit;

-- verify: zero update columns for anon, zero anon write privileges of any kind
select
  (select count(*) from information_schema.role_table_grants
     where grantee = 'anon' and table_schema = 'public'
       and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')) as anon_write_privileges,
  (select count(*) from information_schema.column_privileges
     where grantee = 'anon' and table_schema = 'public' and privilege_type = 'UPDATE') as anon_update_columns,
  (select count(*) from pg_policies
     where schemaname = 'public' and 'anon' = any(roles) and cmd = 'UPDATE') as anon_update_policies;

-- expect: 0, 0, 0

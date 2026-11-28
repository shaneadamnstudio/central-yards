-- 006: anon hardening, for a database that was built before 002 was corrected.
--
-- Run this once on an existing project. On a fresh database, apply 002 through
-- 005 and skip it: 002 already grants anon read-only.
--
-- Why it exists
--   002 originally granted `select, insert, update, delete` on every table to
--   `anon`, which is the key that ships in the browser. 004 then narrowed anon
--   to two columns, but a table-level privilege overrides a column-level one,
--   so the narrowing did nothing. With the publishable key in hand, anyone
--   could rewrite any column of any row they could see: a task's title, its
--   visibility, an activation's colour.
--
--   Separately, anon held TRUNCATE, which comes from Supabase's default grants
--   on the public schema rather than from any grant written here. TRUNCATE is
--   not subject to row level security, so one request could empty a table.
--
-- The end state:
--   anon   SELECT on every table, UPDATE on tasks.status and
--          activations.start_date/end_date only, nothing else
--   authenticated, service_role   unchanged
--
-- Idempotent: safe to run again. Prints a privilege summary at the end.

begin;

do $$
declare t text;
begin
  foreach t in array array[
    'projects','project_links','tasks','activations','activation_support',
    'series','calendar_dates','ideas','social_ideas','quotes','decks','receipts'
  ] loop
    execute format('revoke insert, update, delete on public.%I from anon', t);
    execute format('revoke truncate, trigger, references on public.%I from anon', t);
    execute format('grant select on public.%I to anon', t);
  end loop;
end $$;

-- the two writable columns, granted individually. These are what 004 intends
-- and what makes a tick and a calendar drag land.
grant update (status) on public.tasks to anon;
grant update (start_date, end_date) on public.activations to anon;

-- RLS still gates which rows may be touched
drop policy if exists tasks_anon_update on public.tasks;
create policy tasks_anon_update on public.tasks
  for update to anon
  using (visibility = 'shared')
  with check (visibility = 'shared');

drop policy if exists activations_anon_update on public.activations;
create policy activations_anon_update on public.activations
  for update to anon
  using (visibility = 'shared')
  with check (visibility = 'shared');

-- status must land in the app's vocabulary, whatever writes it
alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks add constraint tasks_status_check
  check (status in ('open', 'doing', 'blocked', 'done'));

commit;

-- verify: anon should hold SELECT on all twelve tables, and UPDATE on exactly
-- three columns. Any table-level INSERT/UPDATE/DELETE here is a failure.
select
  (select count(*) from information_schema.role_table_grants
     where grantee = 'anon' and table_schema = 'public' and privilege_type = 'SELECT') as anon_select_tables,
  (select count(*) from information_schema.role_table_grants
     where grantee = 'anon' and table_schema = 'public'
       and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')) as anon_write_privileges,
  (select string_agg(table_name || '.' || column_name, ', ' order by table_name, column_name)
     from information_schema.column_privileges
    where grantee = 'anon' and table_schema = 'public' and privilege_type = 'UPDATE') as anon_update_columns;

-- expect: anon_select_tables 12, anon_write_privileges 0,
--         anon_update_columns 'activations.end_date, activations.start_date, tasks.status'

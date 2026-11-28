-- Fix: let the browser write task status and activation placement.
--
-- The app authenticates with the publishable (anon) key, because the access
-- code gate sits in the Next middleware rather than in Supabase Auth. My first
-- schema gave anon SELECT only, so every tick and every drag returned HTTP 200
-- with zero rows affected: a silent no-op, the exact failure mode the Supply Co.
-- notes warn about.
--
-- Scope is deliberately narrow. anon may update exactly two columns of exactly
-- two tables:
--     tasks.status
--     activations.start_date, activations.end_date
-- Everything else stays read-only, and internal rows stay invisible.

-- SUPERSEDED ON THE WRITE PATH. Writes now go through /api/state with the
-- service key, and lib/store.js enforces the caller's scope per row, so anon
-- holds no UPDATE at all. See 007_write_path.sql, which removes these grants
-- from a database that already has them.
--
-- The reasoning below is kept because it explains why the grants existed and
-- what broke when they were wide: with `using (visibility = 'shared')` on the
-- policy, an internal task was read-only to everybody, and a table-level grant
-- from 002 overrode the column-level narrowing entirely.

-- a task may only hold these states
alter table public.tasks drop constraint if exists tasks_status_check;
alter table public.tasks add constraint tasks_status_check
  check (status in ('open', 'doing', 'blocked', 'done'));

-- verify: as anon, an update should now report the row back
select
  (select count(*) from information_schema.column_privileges
    where grantee = 'anon' and table_name = 'tasks' and privilege_type = 'UPDATE') as anon_task_cols,
  (select count(*) from information_schema.column_privileges
    where grantee = 'anon' and table_name = 'activations' and privilege_type = 'UPDATE') as anon_act_cols;

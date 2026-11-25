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

-- column-level grants, not table-wide update
grant update (status) on public.tasks to anon;
grant update (start_date, end_date) on public.activations to anon;

-- RLS still gates the row. anon may only touch rows it is already allowed to see.
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

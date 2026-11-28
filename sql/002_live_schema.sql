-- Central Yards x Adam Studios, live schema
-- Apply to project khwbtduvdfrlozsupvls.
--
-- The publishable key ships in the browser, so RLS is mandatory: without it
-- anyone who views source can read and write every row. Every table gets
-- RLS enabled AND grants in the same batch. Policies without grants returns
-- permission denied to every role and looks like a broken app.

-- ---------- enums ----------
do $$ begin create type cy_visibility as enum ('internal','shared'); exception when duplicate_object then null; end $$;
do $$ begin create type cy_lane as enum ('general','special'); exception when duplicate_object then null; end $$;
do $$ begin create type cy_tier as enum ('rapid','standard','big_ideas','big_umbrella'); exception when duplicate_object then null; end $$;
do $$ begin create type cy_quote_status as enum ('submitted','reviewed','confirmed','on_hold'); exception when duplicate_object then null; end $$;
do $$ begin create type cy_owner_side as enum ('adam','central_yards','both'); exception when duplicate_object then null; end $$;

-- ---------- projects ----------
create table if not exists public.projects (
  id              text primary key,
  name            text not null,
  summary         text default '',
  status          text default 'active',
  lane            cy_lane not null default 'general',
  tier            cy_tier,
  owner_name      text default '',
  owner_side      cy_owner_side not null default 'adam',
  key_dates       jsonb not null default '[]'::jsonb,
  next_action     text default '',
  next_action_due date,
  visibility      cy_visibility not null default 'shared',
  source          text default 'manual',
  source_id       text,
  position        int default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.project_links (
  id          text primary key,
  project_id  text references public.projects(id) on delete cascade,
  kind        text not null default 'doc',
  label       text not null,
  url         text not null,
  visibility  cy_visibility not null default 'shared',
  added_by    text default '',
  position    int default 0,
  created_at  timestamptz not null default now()
);

-- ---------- tasks ----------
create table if not exists public.tasks (
  id            text primary key,
  project_id    text references public.projects(id) on delete set null,
  title         text not null,
  detail        text default '',
  owner_name    text default '',
  owner_side    cy_owner_side not null default 'adam',
  due_date      date,
  status        text not null default 'open',
  awaiting_from text default '',
  link_url      text default '',
  visibility    cy_visibility not null default 'shared',
  source        text default 'manual',
  source_id     text,
  position      int default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------- calendar ----------
create table if not exists public.activations (
  id           text primary key,
  title        text not null,
  detail       text default '',
  start_date   date not null,
  end_date     date,
  audience     text not null default 'central_yards',
  series_id    text,
  pitch_room   boolean not null default false,
  pitch_note   text default '',
  colour       text default '',
  visibility   cy_visibility not null default 'shared',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.activation_support (
  activation_id text not null references public.activations(id) on delete cascade,
  project_id    text not null references public.projects(id) on delete cascade,
  note          text default '',
  primary key (activation_id, project_id)
);

create table if not exists public.series (
  id             text primary key,
  name           text not null,
  cadence        text default '',
  rrule          text default '',
  colour         text default '',
  parent_activation_id text references public.activations(id) on delete set null,
  visibility     cy_visibility not null default 'shared',
  created_at     timestamptz not null default now()
);

create table if not exists public.calendar_dates (
  id            text primary key,
  title         text not null,
  kind          text not null default 'custom',
  start_date    date not null,
  end_date      date,
  lunar         boolean not null default false,
  note          text default '',
  created_at    timestamptz not null default now()
);

-- ---------- ideas and social ----------
create table if not exists public.ideas (
  id            text primary key,
  title         text not null,
  detail        text default '',
  kind          text not null default 'partner',
  status        text default 'idea',
  link_project  text references public.projects(id) on delete set null,
  link_activation text references public.activations(id) on delete set null,
  visibility    cy_visibility not null default 'internal',
  position      int default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.social_ideas (
  id          text primary key,
  title       text not null,
  body        text default '',
  theme       text default '',
  channel     text default '',
  status      text default 'dump',
  link_project text references public.projects(id) on delete set null,
  visibility  cy_visibility not null default 'internal',
  position    int default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- finance and decks ----------
create table if not exists public.quotes (
  id          text primary key,
  project_id  text references public.projects(id) on delete set null,
  title       text not null,
  reference   text default '',
  amount      numeric(14,2),
  currency    text default 'HKD',
  quote_url   text default '',
  reviewer    text default '',
  status      cy_quote_status not null default 'submitted',
  issued_date date,
  visibility  cy_visibility not null default 'internal',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.decks (
  id          text primary key,
  project_id  text references public.projects(id) on delete set null,
  title       text not null,
  url         text not null,
  deck_type   text default 'deck',
  version     text default '',
  is_current  boolean not null default false,
  visibility  cy_visibility not null default 'internal',
  created_at  timestamptz not null default now()
);

-- ---------- indexes ----------
create index if not exists tasks_project_idx  on public.tasks(project_id);
create index if not exists tasks_due_idx      on public.tasks(due_date);
create index if not exists links_project_idx  on public.project_links(project_id);
create index if not exists acts_start_idx     on public.activations(start_date);
create index if not exists ideas_project_idx  on public.ideas(link_project);
create index if not exists quotes_project_idx on public.quotes(project_id);
create index if not exists decks_project_idx  on public.decks(project_id);

-- ---------- RLS + grants, one batch ----------
-- Internal rows are filtered in the app for the Central Yards code. Because
-- the publishable key is public, the database also enforces it: anon may read
-- only shared rows, and may never read quotes or decks, which are internal
-- until ADAM shares them.
do $$
declare t text;
begin
  foreach t in array array[
    'projects','project_links','tasks','activations','activation_support',
    'series','calendar_dates','ideas','social_ideas','quotes','decks'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_select', t);
    execute format('drop policy if exists %I on public.%I', t||'_write', t);
    -- anon is the public browser key: read only at the table level. The two
    -- writable columns are granted individually in 004; granting
    -- insert/update/delete here would make those column grants meaningless,
    -- because a table-level privilege overrides a column-level one.
    execute format('grant select on public.%I to anon', t);
    -- truncate, trigger and references arrive with Supabase's default grants
    -- on the public schema, not from anything in this file. TRUNCATE is not
    -- subject to RLS, so an anon key that holds it can empty a table.
    execute format('revoke truncate, trigger, references on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated, service_role', t);
  end loop;
  grant usage on schema public to anon, authenticated, service_role;
end $$;

-- anon: read shared rows only
do $$
declare t text;
begin
  foreach t in array array[
    'projects','project_links','tasks','activations','ideas','social_ideas'
  ] loop
    execute format($f$create policy %I on public.%I for select to anon using (visibility = 'shared')$f$, t||'_select', t);
  end loop;
end $$;

-- activation_support and series carry no visibility column, so they read openly
drop policy if exists activation_support_select on public.activation_support;
create policy activation_support_select on public.activation_support for select to anon using (true);
drop policy if exists series_select on public.series;
create policy series_select on public.series for select to anon using (true);
drop policy if exists calendar_dates_select on public.calendar_dates;
create policy calendar_dates_select on public.calendar_dates for select to anon using (true);

-- quotes and decks: internal until shared, so anon sees only confirmed/shared
drop policy if exists quotes_select on public.quotes;
create policy quotes_select on public.quotes for select to anon
  using (status = 'confirmed' and visibility = 'shared');
drop policy if exists decks_select on public.decks;
create policy decks_select on public.decks for select to anon
  using (visibility = 'shared');

-- authenticated and service_role bypass the visibility filter: this is the
-- ADAM side, and the app already restricts which code a person holds
do $$
declare t text;
begin
  foreach t in array array[
    'projects','project_links','tasks','activations','activation_support',
    'series','calendar_dates','ideas','social_ideas','quotes','decks'
  ] loop
    execute format($f$create policy %I on public.%I for all to authenticated using (true) with check (true)$f$, t||'_write', t);
    execute format($f$create policy %I on public.%I for all to service_role using (true) with check (true)$f$, t||'_svc', t);
  end loop;
end $$;

-- ---------- verify ----------
select
  (select count(*) from public.projects) as projects,
  (select count(*) from public.tasks) as tasks,
  (select count(*) from public.activations) as activations,
  (select count(*) from public.calendar_dates) as calendar_dates;

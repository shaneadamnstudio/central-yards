-- Central Yards x Adam Studios, schema
-- Run in a NEW Supabase project. Verified against PostgREST after apply.
-- Rule carried from Supply Co: grants in the same batch as the create, or
-- every role gets permission denied and it looks like a broken app.

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
  key_dates       jsonb not null default '[]'::jsonb,   -- [{label,date}]
  next_action     text default '',
  next_action_due date,
  visibility      cy_visibility not null default 'shared',
  source          text default 'manual',                -- manual | clickup | sheet
  source_id       text,
  position        int  default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- links attached to a project: Google Docs, decks, folders, anything with a URL
create table if not exists public.project_links (
  id          text primary key,
  project_id  text not null references public.projects(id) on delete cascade,
  kind        text not null default 'doc',   -- doc | deck | folder | quote | sheet | other
  label       text not null,
  url         text not null,
  visibility  cy_visibility not null default 'shared',
  added_by    text default '',
  position    int default 0,
  created_at  timestamptz not null default now()
);

-- ---------- tasks ----------
-- Single table the to-do views read. ClickUp and Sheets import into it.
create table if not exists public.tasks (
  id            text primary key,
  project_id    text references public.projects(id) on delete set null,
  title         text not null,
  detail        text default '',
  owner_name    text default '',
  owner_side    cy_owner_side not null default 'adam',
  due_date      date,
  status        text not null default 'open',   -- open | doing | blocked | done
  awaiting_from text default '',                -- who owes the next action, when in review
  link_url      text default '',                -- direct link, e.g. the feedback doc
  visibility    cy_visibility not null default 'shared',
  source        text default 'manual',
  source_id     text,
  position      int default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------- calendar ----------
-- Marketing activations, 2027 map. Central Yards moments and ADAM work side by side.
create table if not exists public.activations (
  id           text primary key,
  title        text not null,
  detail       text default '',
  start_date   date not null,
  end_date     date,
  audience     text not null default 'central_yards',  -- central_yards | adam | joint
  series_id    text,
  pitch_room   boolean not null default false,         -- ADAM can pitch into this
  pitch_note   text default '',
  colour       text default '',
  visibility   cy_visibility not null default 'shared',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- which projects support which activation
create table if not exists public.activation_support (
  activation_id text not null references public.activations(id) on delete cascade,
  project_id    text not null references public.projects(id) on delete cascade,
  note          text default '',
  primary key (activation_id, project_id)
);

-- recurring editorial series: Central Stories, Makers, Conversations
create table if not exists public.series (
  id             text primary key,
  name           text not null,
  cadence        text default '',          -- human string: fortnightly, monthly, quarterly
  rrule          text default '',          -- optional machine rule
  colour         text default '',
  parent_activation_id text references public.activations(id) on delete set null,
  visibility     cy_visibility not null default 'shared',
  created_at     timestamptz not null default now()
);

-- recurring dates set once a year, carry forward automatically
create table if not exists public.calendar_dates (
  id          text primary key,
  title       text not null,
  kind        text not null default 'custom',  -- holiday | school | typhoon | cny | custom
  month       int not null,
  day         int not null,
  duration_days int default 1,
  lunar       boolean not null default false,  -- true = follows lunar calendar, dates come from overrides
  note        text default '',
  created_at  timestamptz not null default now()
);

-- per-year resolved dates, for lunar or shifting entries
create table if not exists public.calendar_overrides (
  date_key    text not null,      -- calendar_dates.id + ':' + year
  date_id     text not null references public.calendar_dates(id) on delete cascade,
  year        int not null,
  start_date  date not null,
  end_date    date,
  primary key (date_key)
);

-- ---------- ideas ----------
create table if not exists public.ideas (
  id            text primary key,
  title         text not null,
  detail        text default '',
  kind          text not null default 'partner',  -- partner | concept | event | activation | product
  status        text default 'idea',
  link_project  text references public.projects(id) on delete set null,
  link_activation text references public.activations(id) on delete set null,
  visibility    cy_visibility not null default 'internal',
  position      int default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- social brain-dump and themes
create table if not exists public.social_ideas (
  id          text primary key,
  title       text not null,
  body        text default '',
  theme       text default '',
  channel     text default '',
  status      text default 'dump',   -- dump | developing | ready | shared
  link_project text references public.projects(id) on delete set null,
  visibility  cy_visibility not null default 'internal',
  position    int default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- finance ----------
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

-- ---------- decks and pitches ----------
create table if not exists public.decks (
  id          text primary key,
  project_id  text references public.projects(id) on delete set null,
  title       text not null,
  url         text not null,
  deck_type   text default 'deck',   -- deck | pitch | board
  version     text default '',
  is_current  boolean not null default false,
  visibility  cy_visibility not null default 'internal',
  created_at  timestamptz not null default now()
);

-- ---------- programme drops, carried over ----------
create table if not exists public.drop_moves (
  drop_id    text primary key,
  moved_to   text default '',
  removed_at timestamptz,
  restored_at timestamptz
);

-- ---------- indexes ----------
create index if not exists tasks_project_idx    on public.tasks(project_id);
create index if not exists tasks_due_idx        on public.tasks(due_date);
create index if not exists tasks_side_idx       on public.tasks(owner_side);
create index if not exists links_project_idx    on public.project_links(project_id);
create index if not exists acts_start_idx       on public.activations(start_date);
create index if not exists ideas_project_idx    on public.ideas(link_project);
create index if not exists quotes_project_idx   on public.quotes(project_id);
create index if not exists decks_project_idx    on public.decks(project_id);

-- ---------- RLS + grants, in the same batch ----------
do $$
declare t text;
begin
  foreach t in array array[
    'projects','project_links','tasks','activations','activation_support',
    'series','calendar_dates','calendar_overrides','ideas','social_ideas',
    'quotes','decks','drop_moves'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_all', t);
    execute format('create policy %I on public.%I for all using (true) with check (true)', t||'_all', t);
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated, service_role', t);
  end loop;
  grant usage on schema public to anon, authenticated, service_role;
end $$;

-- ---------- verify ----------
select 'projects' as t, count(*) from public.projects
union all select 'tasks', count(*) from public.tasks
union all select 'activations', count(*) from public.activations
union all select 'calendar_dates', count(*) from public.calendar_dates;

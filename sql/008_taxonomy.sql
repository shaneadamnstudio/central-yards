-- 008: taxonomy columns, so colour can mean something.
--
-- The app has had tiers defined in config.json since the first build, with a
-- colour each, and 0 of 31 projects carried one. Every activation was
-- audience 'joint' with no colour and no series. So every surface rendered in
-- one tone, which reads as "nothing is categorised" because nothing was.
--
-- The shape here separates what a machine can propose from what a person
-- confirms:
--
--   tags_suggested / tier_suggested   derived from the tracker, provisional
--   tags / tier                       set by the client, what the app trusts
--
-- The UI shows the confirmed value when it exists and the suggestion, muted,
-- when it does not. That way the board is useful before Carol has ruled on
-- anything, and her ruling overrides rather than competes.
--
-- Idempotent. Safe to run on a fresh build and on an existing one.

begin;

alter table public.projects
  add column if not exists tags text[] default '{}',
  add column if not exists tags_suggested text[] default '{}',
  add column if not exists tier_suggested text;

alter table public.activations
  add column if not exists tags text[] default '{}',
  add column if not exists tags_suggested text[] default '{}';

-- a deck is working, submitted, or final. The client scope may only see final,
-- which is the difference between a Figma link that is still being edited and
-- a deck the studio has actually sent.
alter table public.decks
  add column if not exists deck_status text default 'draft';

alter table public.decks drop constraint if exists decks_status_check;
alter table public.decks add constraint decks_status_check
  check (deck_status in ('draft', 'submitted', 'final'));

create index if not exists projects_tags_idx on public.projects using gin (tags);
create index if not exists activations_tags_idx on public.activations using gin (tags);

commit;

-- verify: four new columns, one constraint, and the split is visible
select
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'projects'
       and column_name in ('tags','tags_suggested','tier_suggested')) as projects_cols,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'activations'
       and column_name in ('tags','tags_suggested')) as activations_cols,
  (select count(*) from public.projects where tags_suggested is not null) as projects_with_suggestions,
  (select count(*) from public.activations where tags_suggested is not null) as activations_with_suggestions;

-- expect: 3, 2, 0, 0 before the deriver runs

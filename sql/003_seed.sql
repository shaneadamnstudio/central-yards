-- Central Yards, seed data
-- Run AFTER 002_live_schema.sql. Safe to re-run: every insert upserts.
--
-- This is the sample data currently in app/public/seed.json. Replace it with
-- the real tracker export when the ClickUp / Google Sheet sync is connected.

-- ---------- projects ----------
insert into public.projects (id, name, summary, status, lane, tier, owner_name, owner_side, key_dates, next_action, next_action_due, visibility)
values
  ('proj-1', 'Opening season identity', 'Naming, mark and tone for phase one.', 'active', 'special', 'big_umbrella', 'Shane', 'adam',
   '[{"label":"Concept lock","date":"2027-03-01"}]'::jsonb, 'Send concept board', '2026-12-04', 'shared'),
  ('proj-2', 'Central Stories series', 'Fortnightly editorial on makers behind the mall.', 'active', 'general', 'standard', 'Keung Gor', 'adam',
   '[]'::jsonb, 'Draft ep1 outline', '2026-12-01', 'shared'),
  ('proj-3', 'Internal pitch: maison retail', 'ADAM-only pitch not ready to show.', 'active', 'special', 'big_ideas', 'Shane', 'adam',
   '[]'::jsonb, 'Decide whether to pitch', '2026-12-10', 'internal')
on conflict (id) do update set
  name = excluded.name, summary = excluded.summary, status = excluded.status,
  lane = excluded.lane, tier = excluded.tier, owner_name = excluded.owner_name,
  key_dates = excluded.key_dates, next_action = excluded.next_action,
  next_action_due = excluded.next_action_due, visibility = excluded.visibility;

-- ---------- project links ----------
insert into public.project_links (id, project_id, kind, label, url, visibility, added_by)
values
  ('l-1', 'proj-1', 'doc', 'Opening season brief', 'https://docs.google.com/document/d/example-brief', 'shared', 'Shane'),
  ('l-2', 'proj-3', 'deck', 'Internal maison deck', 'https://docs.google.com/presentation/d/example-internal', 'internal', 'Shane')
on conflict (id) do update set
  label = excluded.label, url = excluded.url, visibility = excluded.visibility;

-- ---------- tasks ----------
insert into public.tasks (id, project_id, title, owner_name, owner_side, due_date, status, awaiting_from, link_url, visibility)
values
  ('t-1', 'proj-1', 'Conversations feedback', 'Keung Gor', 'adam', '2026-11-30', 'open', 'Central Yards marketing', 'https://docs.google.com/document/d/example-feedback', 'shared'),
  ('t-2', 'proj-2', 'Approve shoot dates', 'CY Marketing', 'central_yards', '2026-12-02', 'open', '', '', 'shared'),
  ('t-3', 'proj-3', 'Internal: scope maison idea', 'Shane', 'adam', '2026-12-05', 'open', '', '', 'internal')
on conflict (id) do update set
  title = excluded.title, project_id = excluded.project_id, owner_name = excluded.owner_name,
  owner_side = excluded.owner_side, due_date = excluded.due_date,
  awaiting_from = excluded.awaiting_from, link_url = excluded.link_url, visibility = excluded.visibility;

-- ---------- activations ----------
insert into public.activations (id, title, detail, start_date, end_date, audience, pitch_room, pitch_note, visibility)
values
  ('act-op-2027', 'Central Yards phase one opening',
   'Henderson Land phase one, around 100 first-to-market brands, five duplex maisons. Target month October 2027.',
   '2027-10-01', '2027-10-31', 'joint', true,
   'Opening moment is the biggest single pitch surface in the year. ADAM work here sets the template for everything after.',
   'shared')
on conflict (id) do update set
  title = excluded.title, detail = excluded.detail, start_date = excluded.start_date,
  end_date = excluded.end_date, pitch_room = excluded.pitch_room,
  pitch_note = excluded.pitch_note, visibility = excluded.visibility;

insert into public.activation_support (activation_id, project_id, note)
values ('act-op-2027', 'proj-1', 'Identity anchors the opening')
on conflict (activation_id, project_id) do nothing;

-- ---------- series ----------
insert into public.series (id, name, cadence, colour, visibility)
values
  ('ser-stories', 'Central Stories', 'Fortnightly', '#a08967', 'shared'),
  ('ser-makers', 'Makers', 'Monthly', '#1d4ed8', 'shared'),
  ('ser-conversations', 'Conversations', 'Monthly', '#1a7a4a', 'shared')
on conflict (id) do update set name = excluded.name, cadence = excluded.cadence, colour = excluded.colour;

-- ---------- ideas ----------
insert into public.ideas (id, title, detail, kind, status, link_project, link_activation, visibility)
values
  ('i-1', 'Reclaimed-material furniture run', 'Object idea built from demolition material on site.', 'product', 'idea', 'proj-1', null, 'internal'),
  ('i-2', 'Local ceramicist residency', 'Partner concept for opening season.', 'partner', 'idea', null, 'act-op-2027', 'shared')
on conflict (id) do update set
  title = excluded.title, detail = excluded.detail, kind = excluded.kind,
  link_project = excluded.link_project, link_activation = excluded.link_activation,
  visibility = excluded.visibility;

-- ---------- social ----------
insert into public.social_ideas (id, title, body, theme, channel, status, link_project, visibility)
values
  ('s-1', 'Behind the shopfront', 'Short vertical series with first-to-market brands.', 'Craft', 'Instagram', 'developing', 'proj-2', 'internal'),
  ('s-2', 'Opening countdown', '90 day countdown with tenant reveals.', 'Launch', 'Instagram, 小紅書', 'ready', 'proj-1', 'shared')
on conflict (id) do update set
  title = excluded.title, body = excluded.body, theme = excluded.theme,
  channel = excluded.channel, status = excluded.status, visibility = excluded.visibility;

-- ---------- quotes ----------
insert into public.quotes (id, project_id, title, reference, amount, currency, quote_url, reviewer, status, issued_date, visibility)
values
  ('q-1', 'proj-1', 'Identity phase one', 'CY-2027-001', 85000, 'HKD', 'https://docs.google.com/spreadsheets/d/example-quote', 'Keung Gor', 'submitted', '2026-11-20', 'internal'),
  ('q-2', 'proj-2', 'Stories season one', 'CY-2027-002', 120000, 'HKD', '', 'CY Finance', 'confirmed', '2026-11-10', 'shared')
on conflict (id) do update set
  title = excluded.title, amount = excluded.amount, reviewer = excluded.reviewer,
  status = excluded.status, quote_url = excluded.quote_url, visibility = excluded.visibility;

-- ---------- decks ----------
insert into public.decks (id, project_id, title, url, deck_type, version, is_current, visibility)
values
  ('dk-1', 'proj-1', 'Opening season, concept board', 'https://docs.google.com/presentation/d/example-deck', 'deck', 'v3', true, 'shared'),
  ('dk-2', 'proj-1', 'Opening season, early route', 'https://docs.google.com/presentation/d/example-deck-old', 'deck', 'v1', false, 'shared')
on conflict (id) do update set
  title = excluded.title, url = excluded.url, version = excluded.version,
  is_current = excluded.is_current, visibility = excluded.visibility;

-- ---------- verify ----------
select
  (select count(*) from public.projects) as projects,
  (select count(*) from public.tasks) as tasks,
  (select count(*) from public.activations) as activations,
  (select count(*) from public.series) as series,
  (select count(*) from public.ideas) as ideas,
  (select count(*) from public.quotes) as quotes;

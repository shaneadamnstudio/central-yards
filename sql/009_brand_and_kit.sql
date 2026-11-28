-- 009: brand assets and the kit of parts.
--
-- Two things Eugene asked for, built as one framework so the next site reuses
-- it rather than rebuilding it.
--
--   1. A brand asset section: brand books, colours, guidelines, videos and
--      logos, per site. Central Yards is the first tenant, not a special case.
--   2. A kit of parts: a named list of blocks a site can show, chosen per
--      launch. A block is on or off for a site, and that is a row, not a deploy.
--
-- Nothing here assumes where files live. `storage_kind` records it per asset:
--
--   supabase   uploaded here, served through a signed URL, real access control
--   drive      a Google Drive link, access governed by Drive
--   dropbox    a Dropbox link, access governed by Dropbox
--   link       anything else, e.g. a Figma deck
--
-- That keeps the open decision (canonical store, and who owns upload) out of
-- the schema. Changing the answer later is data, not a migration.
--
-- Idempotent.

begin;

-- ---------- tenants ----------
create table if not exists public.sites (
  key        text primary key,
  name       text not null,
  created_at timestamptz not null default now()
);

insert into public.sites (key, name)
values ('central-yards', 'Central Yards')
on conflict (key) do nothing;

-- ---------- brand assets ----------
create table if not exists public.brand_assets (
  id            text primary key,
  site_key      text not null references public.sites(key) on delete cascade default 'central-yards',
  kind          text not null check (kind in ('brand_book','colour','guideline','video','logo','other')),
  title         text not null,
  subtitle      text default '',
  format        text default '',          -- PDF, MP4, SVG, HEX...
  storage_kind  text not null default 'link' check (storage_kind in ('supabase','drive','dropbox','link')),
  url           text default '',          -- when storage_kind is not supabase
  storage_path  text default '',          -- bucket key when storage_kind is supabase
  value         text default '',          -- for colours: the hex
  bytes         bigint,
  version       text default '',
  visibility    cy_visibility not null default 'shared',
  position      int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists brand_assets_site_idx on public.brand_assets(site_key, kind, position);

-- ---------- kit of parts ----------
-- every block a site may show. `enabled` is the launch decision.
create table if not exists public.site_blocks (
  site_key   text not null references public.sites(key) on delete cascade default 'central-yards',
  block_key  text not null,
  enabled    boolean not null default true,
  position   int not null default 0,
  primary key (site_key, block_key)
);

-- the standard set. purpose is the one line the framework document repeats.
insert into public.site_blocks (site_key, block_key, enabled, position) values
  ('central-yards','overview',     true, 10),
  ('central-yards','brand',        true, 20),
  ('central-yards','calendar',     true, 30),
  ('central-yards','projects',     true, 40),
  ('central-yards','tasks',        true, 50),
  ('central-yards','partnerships', true, 60),
  ('central-yards','social',       true, 70),
  ('central-yards','decks',        true, 80),
  ('central-yards','finance',      true, 90),
  ('central-yards','budget',       false,100)
on conflict (site_key, block_key) do nothing;

-- ---------- RLS ----------
alter table public.sites        enable row level security;
alter table public.brand_assets enable row level security;
alter table public.site_blocks  enable row level security;

drop policy if exists sites_select on public.sites;
create policy sites_select on public.sites for select to anon using (true);

drop policy if exists brand_assets_select on public.brand_assets;
create policy brand_assets_select on public.brand_assets for select to anon
  using (visibility = 'shared');

drop policy if exists site_blocks_select on public.site_blocks;
create policy site_blocks_select on public.site_blocks for select to anon using (true);

do $$
declare t text;
begin
  foreach t in array array['sites','brand_assets','site_blocks'] loop
    execute format('grant select on public.%I to anon', t);
    execute format('revoke insert, update, delete, truncate, trigger, references on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated, service_role', t);
  end loop;
end $$;

-- ---------- storage for uploaded assets ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brand',
  'brand',
  false,
  52428800,  -- 50 MB: a brand book or a short film, not a raw master
  array[
    'application/pdf','image/jpeg','image/png','image/webp','image/svg+xml',
    'video/mp4','video/quicktime','application/zip',
    'application/postscript','font/ttf','font/otf','application/octet-stream'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

commit;

select
  (select count(*) from public.sites) as sites,
  (select count(*) from public.site_blocks where enabled) as blocks_enabled,
  (select count(*) from public.site_blocks where not enabled) as blocks_disabled,
  (select count(*) from public.brand_assets) as assets;

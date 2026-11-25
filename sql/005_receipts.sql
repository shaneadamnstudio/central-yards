-- Receipts and invoices: storage bucket, table, and access rules.
--
-- Receipts carry amounts and supplier names, so the bucket is PRIVATE.
-- Files are reached through time-limited signed URLs, never a public link.
-- Nothing here is readable by the anon key, which ships in the browser.

-- ---------- bucket ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'finance',
  'finance',
  false,
  10485760,  -- 10 MB, enough for a scanned invoice at readable quality
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/tiff',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------- the receipt record ----------
create table if not exists public.receipts (
  id            text primary key,
  project_id    text references public.projects(id) on delete set null,
  quote_id      text references public.quotes(id) on delete set null,
  title         text not null,
  vendor        text default '',
  amount        numeric(14,2),
  currency      text default 'HKD',
  doc_type      text not null default 'receipt',   -- receipt | invoice | statement | other
  category      text default '',
  issued_date   date,
  status        text not null default 'filed',     -- filed | claimed | reimbursed | void
  -- storage location inside the bucket, so the file can be fetched by signed URL
  file_path     text not null,
  file_name     text default '',
  file_size     bigint,
  file_type     text default '',
  uploaded_by   text default '',
  note          text default '',
  visibility    cy_visibility not null default 'internal',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists receipts_project_idx on public.receipts(project_id);
create index if not exists receipts_quote_idx   on public.receipts(quote_id);
create index if not exists receipts_date_idx    on public.receipts(issued_date);

-- ---------- RLS on the table ----------
alter table public.receipts enable row level security;

drop policy if exists receipts_select on public.receipts;
drop policy if exists receipts_write  on public.receipts;
drop policy if exists receipts_update on public.receipts;
drop policy if exists receipts_delete on public.receipts;
drop policy if exists receipts_svc    on public.receipts;

-- anon: nothing. A receipt is a financial document and the key is public.
-- The app reads receipts through the server, which holds the session.

create policy receipts_write  on public.receipts for insert to authenticated with check (true);
create policy receipts_update on public.receipts for update to authenticated using (true) with check (true);
create policy receipts_delete on public.receipts for delete to authenticated using (true);
create policy receipts_svc    on public.receipts for all    to service_role using (true) with check (true);

grant select, insert, update, delete on public.receipts to authenticated, service_role;

-- ---------- storage object policies ----------
-- Objects in this bucket are private. authenticated may read and write;
-- anon gets nothing, so a leaked publishable key cannot list receipts.
drop policy if exists finance_read   on storage.objects;
drop policy if exists finance_write  on storage.objects;
drop policy if exists finance_delete on storage.objects;

create policy finance_read on storage.objects
  for select to authenticated
  using (bucket_id = 'finance');

create policy finance_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'finance');

create policy finance_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'finance');

-- ---------- verify ----------
select
  (select count(*) from storage.buckets where id = 'finance') as bucket_exists,
  (select count(*) from public.receipts) as receipts;

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

/**
 * Upload a brand asset.
 *
 * Server-side only, service key, scope checked here. Modelled on the receipts
 * upload for the same reasons: the browser key is public, so a file write must
 * never happen from it, and the bucket stays private with access minted as a
 * short signed URL at read time.
 *
 * Who may upload: the studio scope only. A client adding to the canonical brand
 * store is the support problem the framework doc calls out, so this route
 * refuses `cy` outright rather than hiding the button and hoping.
 *
 * Form fields
 *   file        required, one file
 *   title       required
 *   kind        brand_book | colour | guideline | video | logo | other
 *   subtitle    optional
 *   format      optional, inferred from the file if absent
 *   visibility  shared | internal, defaults to shared
 */

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE = process.env.SITE_KEY || 'central-yards';
const BUCKET = 'brand';
const MAX_BYTES = 50 * 1024 * 1024;

const KINDS = ['brand_book', 'colour', 'guideline', 'video', 'logo', 'other'];
const VISIBILITIES = ['shared', 'internal'];
const ALLOWED = new Set([
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/svg+xml',
  'video/mp4', 'video/quicktime', 'application/zip', 'application/postscript',
  'font/ttf', 'font/otf', 'application/octet-stream',
]);

function client() {
  if (!URL_ || !SERVICE) return null;
  return createClient(URL_, SERVICE, { auth: { persistSession: false } });
}

function slug(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'asset';
}

function extFor(file) {
  const named = (file.name || '').split('.').pop();
  if (named && named.length <= 5) return named.toLowerCase();
  const map = {
    'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg',
    'image/webp': 'webp', 'image/svg+xml': 'svg', 'video/mp4': 'mp4',
    'video/quicktime': 'mov', 'application/zip': 'zip', 'font/ttf': 'ttf',
    'font/otf': 'otf', 'application/postscript': 'ai',
  };
  return map[file.type] || 'bin';
}

export async function POST(request) {
  const scope = (await headers()).get('x-cy-scope') || 'cy';
  if (scope !== 'adam') {
    return NextResponse.json({ error: 'Uploads are restricted to the studio' }, { status: 403 });
  }

  const sb = client();
  if (!sb) {
    return NextResponse.json(
      { error: 'Uploads need SUPABASE_SERVICE_ROLE_KEY set in the environment.' },
      { status: 500 },
    );
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Expected a multipart form' }, { status: 400 });
  }

  const file = form.get('file');
  const title = String(form.get('title') || '').trim();
  const kind = String(form.get('kind') || '').trim();
  const visibility = String(form.get('visibility') || 'shared').trim();
  const subtitle = String(form.get('subtitle') || '').trim();

  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file attached' }, { status: 400 });
  }
  if (!title) return NextResponse.json({ error: 'A title is required' }, { status: 400 });
  if (!KINDS.includes(kind)) return NextResponse.json({ error: `Unknown kind ${kind}` }, { status: 400 });
  if (!VISIBILITIES.includes(visibility)) {
    return NextResponse.json({ error: `Unknown visibility ${visibility}` }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File is over the 50 MB limit' }, { status: 413 });
  }
  if (file.type && !ALLOWED.has(file.type)) {
    return NextResponse.json({ error: `That file type is not accepted (${file.type})` }, { status: 415 });
  }

  const ext = extFor(file);
  const path = `${SITE}/${kind}/${slug(title)}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (upErr) {
    return NextResponse.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 });
  }

  const row = {
    id: `ba-${slug(title)}-${Date.now()}`,
    site_key: SITE,
    kind,
    title,
    subtitle,
    format: (form.get('format') || ext).toString().toUpperCase(),
    storage_kind: 'supabase',
    storage_path: path,
    bytes: file.size,
    visibility,
    position: 100,
  };

  const { data, error: insErr } = await sb.from('brand_assets').insert(row).select('*').single();
  if (insErr) {
    /* do not leave an orphan object behind if the row cannot be written */
    await sb.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ error: `Record failed: ${insErr.message}` }, { status: 500 });
  }

  /* read back: the row must be there and point at the object we just stored */
  const { data: check } = await sb.from('brand_assets').select('id,storage_path').eq('id', row.id).maybeSingle();
  if (!check || check.storage_path !== path) {
    return NextResponse.json({ error: 'Write did not land' }, { status: 500 });
  }

  return NextResponse.json({ asset: { ...data, url: '' } }, { status: 201 });
}

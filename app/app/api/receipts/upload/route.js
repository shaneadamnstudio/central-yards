import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * Upload a receipt or invoice.
 *
 * The bucket is private and the publishable key is public, so the browser
 * cannot write to storage directly. This route holds the service key on the
 * server, refuses anything that is not a document, caps the size, and writes
 * a receipts row with the storage path so the file can be fetched later by a
 * time-limited signed URL.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in the environment. Without it the route
 * refuses rather than half-working.
 */

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/tiff',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

function safeName(name) {
  return String(name || 'file')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(-120);
}

export async function POST(request) {
  if (!URL_ || !SERVICE) {
    return NextResponse.json(
      { error: 'Uploads need SUPABASE_SERVICE_ROLE_KEY set in the environment.' },
      { status: 500 }
    );
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Malformed upload' }, { status: 400 });
  }

  const file = form.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'No file received' }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `That file is ${(file.size / 1048576).toFixed(1)} MB. The limit is 10 MB.` },
      { status: 413 }
    );
  }

  const type = file.type || 'application/octet-stream';
  if (!ALLOWED.includes(type)) {
    return NextResponse.json(
      { error: 'Only PDF, image and spreadsheet files are accepted.' },
      { status: 415 }
    );
  }

  const id = `rc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const name = safeName(file.name);
  /* date-foldered so a bucket listing stays readable as years accumulate */
  const today = new Date().toISOString().slice(0, 10);
  const path = `${today.slice(0, 7)}/${id}-${name}`;

  const bytes = Buffer.from(await file.arrayBuffer());

  const upRes = await fetch(`${URL_}/storage/v1/object/finance/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE}`,
      'Content-Type': type,
      'x-upsert': 'false',
    },
    body: bytes,
  });

  if (!upRes.ok) {
    const detail = await upRes.text().catch(() => '');
    return NextResponse.json(
      { error: `Storage refused the upload (${upRes.status}). ${detail.slice(0, 200)}` },
      { status: 502 }
    );
  }

  const row = {
    id,
    project_id: form.get('project_id') || null,
    quote_id: form.get('quote_id') || null,
    title: String(form.get('title') || file.name || 'Receipt'),
    vendor: String(form.get('vendor') || ''),
    amount: form.get('amount') ? Number(form.get('amount')) : null,
    currency: String(form.get('currency') || 'HKD'),
    doc_type: String(form.get('doc_type') || 'receipt'),
    category: String(form.get('category') || ''),
    issued_date: form.get('issued_date') || null,
    status: 'filed',
    file_path: path,
    file_name: name,
    file_size: file.size,
    file_type: type,
    uploaded_by: String(form.get('uploaded_by') || ''),
    note: String(form.get('note') || ''),
    visibility: 'internal',
  };

  const insRes = await fetch(`${URL_}/rest/v1/receipts`, {
    method: 'POST',
    headers: {
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify([row]),
  });

  if (!insRes.ok) {
    const detail = await insRes.text().catch(() => '');
    /* the file is already in storage: remove it rather than orphan it */
    await fetch(`${URL_}/storage/v1/object/finance/${path}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${SERVICE}` },
    });
    return NextResponse.json(
      { error: `Saved the file but not the record (${insRes.status}). ${detail.slice(0, 160)}` },
      { status: 502 }
    );
  }

  const saved = await insRes.json();

  /* read back: a write is not done until the row is there */
  const checkRes = await fetch(
    `${URL_}/rest/v1/receipts?id=eq.${encodeURIComponent(id)}&select=id,title,file_path`,
    { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } }
  );
  const check = await checkRes.json().catch(() => []);
  if (!Array.isArray(check) || !check.length) {
    return NextResponse.json({ error: 'Upload did not read back' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, receipt: saved[0] });
}

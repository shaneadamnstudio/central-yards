import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * List receipts, and mint a short-lived signed URL for each file.
 *
 * The bucket is private, so a stored file has no public address. A signed URL
 * lasts minutes and is generated per request. That way a receipt cannot be
 * forwarded by copying a link out of the page.
 */

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

/* five minutes: long enough to open the file, short enough not to be a link */
const SIGN_SECONDS = 300;

export async function GET() {
  if (!URL_ || !SERVICE) {
    return NextResponse.json(
      { error: 'Receipts need SUPABASE_SERVICE_ROLE_KEY set in the environment.' },
      { status: 500 }
    );
  }

  const res = await fetch(
    `${URL_}/rest/v1/receipts?select=*&order=issued_date.desc.nullslast,created_at.desc`,
    { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` }, cache: 'no-store' }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return NextResponse.json(
      { error: `Could not read receipts (${res.status}). ${detail.slice(0, 160)}` },
      { status: 502 }
    );
  }

  const rows = await res.json();

  /* sign every file in one call rather than one request per row */
  let signed = {};
  const paths = rows.map((r) => r.file_path).filter(Boolean);
  if (paths.length) {
    const signRes = await fetch(`${URL_}/storage/v1/object/sign/finance`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SERVICE}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: SIGN_SECONDS, paths }),
    });
    if (signRes.ok) {
      const list = await signRes.json().catch(() => []);
      (Array.isArray(list) ? list : []).forEach((s) => {
        if (s && s.path) signed[s.path] = `${URL_}/storage/v1${s.signedURL}`;
      });
    }
  }

  return NextResponse.json({
    receipts: rows.map((r) => ({
      ...r,
      signed_url: signed[r.file_path] || null,
      expires_in: SIGN_SECONDS,
    })),
  });
}

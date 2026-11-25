import { NextResponse } from 'next/server';

const COOKIE = 'cy_access';

function days() {
  const d = Number(process.env.GATE_DAYS || 30);
  return Number.isFinite(d) && d > 0 ? d : 30;
}

function normalise(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[\u2010-\u2015\u2212\uff0d]/g, '-')
    .replace(/[^a-z0-9]/g, '');
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * GATE_CODES format, comma separated, one entry per team:
 *   adam:<salt>:<hash>,cy:<salt>:<hash>
 * The scope prefix identifies the team the code belongs to.
 */
async function scopeFor(input) {
  const raw = process.env.GATE_CODES || '';
  const entries = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const attempt = normalise(input);
  if (!attempt) return null;
  for (const entry of entries) {
    const [scope, salt, hash] = entry.split(':');
    if (!scope || !salt || !hash) continue;
    const got = await sha256Hex(salt + attempt);
    if (safeEqual(got, hash)) return scope;
  }
  return null;
}

export async function POST(request) {
  const form = await request.formData();
  const code = String(form.get('code') || '');
  const next = String(form.get('next') || '/');
  const dest = new URL(next.startsWith('/') ? next : '/', request.url);

  const scope = await scopeFor(code);

  if (!scope) {
    const fail = new URL('/login', request.url);
    fail.searchParams.set('error', 'That access code is not right.');
    if (next && next !== '/') fail.searchParams.set('next', next);
    return NextResponse.redirect(fail, { status: 303 });
  }

  const res = NextResponse.redirect(dest, { status: 303 });
  res.cookies.set(COOKIE, `${scope}:${process.env.GATE_SECRET || 'unset'}`, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: days() * 24 * 60 * 60,
  });
  return res;
}

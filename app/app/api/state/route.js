import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { readState, patchState } from '../../../lib/store';

/** the scope the middleware put on the request, never the body */
async function scope() {
  return (await headers()).get('x-cy-scope') || 'cy';
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/** what the browser has already written, merged over the workspace on load */
export async function GET() {
  try {
    const state = await readState(await scope());
    return NextResponse.json(state);
  } catch (e) {
    return NextResponse.json({ error: String((e && e.message) || e) }, { status: 500 });
  }
}

/**
 * A write must say whether it worked. patchState throws on any write that did
 * not change a row, so a failure here is always real and always reported.
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed body' }, { status: 400 });
  }

  const patch = {};
  if (body.tasks && typeof body.tasks === 'object') patch.tasks = body.tasks;
  if (body.placements && typeof body.placements === 'object') patch.placements = body.placements;

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'Nothing to write' }, { status: 400 });
  }

  try {
    const result = await patchState(patch, await scope());
    return NextResponse.json({ ok: true, backend: result.backend });
  } catch (e) {
    return NextResponse.json({ error: String((e && e.message) || e) }, { status: 500 });
  }
}

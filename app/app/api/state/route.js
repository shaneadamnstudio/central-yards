import { NextResponse } from 'next/server';
import { readState, patchState } from '../../../lib/store';

export const dynamic = 'force-dynamic';

/* what the browser has already written, merged over the seed on load */
export async function GET() {
  try {
    const state = await readState();
    return NextResponse.json(state);
  } catch (e) {
    return NextResponse.json({ error: 'Could not read state' }, { status: 500 });
  }
}

/**
 * A write must say whether it worked. Silent catch blocks hid a broken
 * archive write for days on the Supply Co. build.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const patch = {};

    if (body.tasks && typeof body.tasks === 'object') patch.tasks = body.tasks;
    if (body.placements && typeof body.placements === 'object') patch.placements = body.placements;

    if (!Object.keys(patch).length) {
      return NextResponse.json({ error: 'Nothing to write' }, { status: 400 });
    }

    const next = await patchState(patch);

    /* read back before claiming success */
    const check = await readState();
    const ok = Object.keys(patch.tasks || {}).every(
      (k) => patch.tasks[k] === null ? !(k in check.tasks) : check.tasks[k] === patch.tasks[k]
    );

    if (!ok) {
      return NextResponse.json({ error: 'Write did not stick' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, updatedAt: next.updatedAt });
  } catch (e) {
    return NextResponse.json({ error: String(e && e.message ? e.message : e) }, { status: 500 });
  }
}

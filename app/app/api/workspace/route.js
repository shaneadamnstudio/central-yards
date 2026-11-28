import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { loadWorkspace } from '../../../lib/workspace';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * Everything the workspace renders, from Supabase, filtered to the caller's
 * scope. The scope comes from the middleware, which reads it out of the signed
 * access cookie: this route never trusts the client to say who it is.
 */
export async function GET() {
  try {
    const scope = (await headers()).get('x-cy-scope') || 'cy';
    const data = await loadWorkspace(scope);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e && e.message ? e.message : e) }, { status: 500 });
  }
}

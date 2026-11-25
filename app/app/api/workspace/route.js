import { NextResponse } from 'next/server';
import { loadWorkspace } from '../../../lib/workspace';

export const dynamic = 'force-dynamic';

/** everything the workspace renders, from Supabase when the tables exist */
export async function GET() {
  try {
    const data = await loadWorkspace();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e && e.message ? e.message : e) }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Diagnostic: which expected environment variables the running deployment
 * can actually see.
 *
 * Values are never returned. Only presence, plus the first four characters of
 * a variable name's siblings, so a typo or a stray prefix can be spotted
 * without leaking a secret into the page.
 */
const EXPECTED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GATE_SECRET',
  'GATE_DAYS',
  'GATE_CODES',
];

export async function GET() {
  /* every env var whose name mentions supabase or gate, so a typo shows up */
  const relevant = Object.keys(process.env)
    .filter((k) => /supabase|gate|service/i.test(k))
    .sort();

  const check = {};
  EXPECTED.forEach((k) => {
    const v = process.env[k];
    check[k] = {
      present: typeof v === 'string' && v.length > 0,
      length: typeof v === 'string' ? v.length : 0,
    };
  });

  return NextResponse.json({
    expected: check,
    /* names only. never values. */
    namesVisibleToTheServer: relevant,
    nodeEnv: process.env.NODE_ENV || null,
    vercelEnv: process.env.VERCEL_ENV || null,
  });
}

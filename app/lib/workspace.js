/**
 * Reads the workspace from Supabase.
 *
 * No seed fallback for the tables themselves. If the schema is missing the
 * page must say so rather than silently rendering content that the database
 * cannot save: a fallback that looks like live data is worse than an error,
 * because every write then appears to work and none of them persist.
 */

import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let sb;
function db() {
  if (!URL || !KEY) {
    throw new Error('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
  }
  if (!sb) {
    sb = createClient(URL, KEY, {
      auth: { persistSession: false },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
    });
  }
  return sb;
}

export const TABLES = [
  'projects',
  'project_links',
  'tasks',
  'activations',
  'activation_support',
  'series',
  'ideas',
  'social_ideas',
  'quotes',
  'decks',
];

export async function loadWorkspace() {
  const client = db();
  const results = await Promise.all(TABLES.map((t) => client.from(t).select('*')));

  const failed = results
    .map((r, i) => (r.error ? { table: TABLES[i], error: r.error.message } : null))
    .filter(Boolean);

  if (failed.length) {
    /* name the missing table, do not degrade to invented content */
    const first = failed[0];
    throw new Error(
      `Table ${first.table} is unavailable (${first.error}). ` +
      'Apply sql/002_live_schema.sql to the project before running the app.'
    );
  }

  const out = { source: 'supabase' };
  TABLES.forEach((t, i) => { out[t] = results[i].data || []; });
  return out;
}

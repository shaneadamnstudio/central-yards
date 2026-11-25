/**
 * Reads the workspace from Supabase, falling back to public/seed.json.
 *
 * The app is usable before the schema is applied and reports which source it
 * used, so a fallback is never mistaken for live data.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let sb;
function db() {
  if (!URL || !KEY) return null;
  if (!sb) sb = createClient(URL, KEY, { auth: { persistSession: false } });
  return sb;
}

const TABLES = [
  ['projects', 'projects'],
  ['project_links', 'project_links'],
  ['tasks', 'tasks'],
  ['activations', 'activations'],
  ['activation_support', 'activation_support'],
  ['series', 'series'],
  ['ideas', 'ideas'],
  ['social_ideas', 'social_ideas'],
  ['quotes', 'quotes'],
  ['decks', 'decks'],
];

export async function loadWorkspace() {
  const client = db();

  if (client) {
    const results = await Promise.all(TABLES.map(([table]) => client.from(table).select('*')));
    const failed = results.filter((r) => r.error);

    if (!failed.length) {
      const out = { source: 'supabase' };
      TABLES.forEach(([, key], i) => { out[key] = results[i].data || []; });
      return out;
    }

    const why = (failed[0].error && failed[0].error.message) || 'unknown';
    console.warn('[workspace] supabase read failed, using seed.json:', why);
  }

  /* seed fallback, read straight off disk so it works in any runtime */
  try {
    const file = path.join(process.cwd(), 'public', 'seed.json');
    const seed = JSON.parse(await fs.readFile(file, 'utf8'));
    const out = { source: 'seed' };
    TABLES.forEach(([, key]) => { out[key] = seed[key] || []; });
    return out;
  } catch (e) {
    const out = { source: 'empty' };
    TABLES.forEach(([, key]) => { out[key] = []; });
    return out;
  }
}

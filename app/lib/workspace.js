/**
 * Reads the workspace from Supabase.
 *
 * Reads with the SERVICE key, server-side only, and applies the caller's scope
 * here. That is deliberate, and it is the reason for two things:
 *
 *   1. The browser key is public, so with the publishable key this function
 *      could never see an internal row at all. The ADAM team lost its own draft
 *      pitches, and the scope filter had nothing left to filter.
 *   2. Filtering twice is fine. Filtering once, in the wrong layer, is what
 *      broke it before: RLS stripped internal rows before the scope was known,
 *      so both codes received byte-identical payloads.
 *
 * SUPABASE_SERVICE_ROLE_KEY must never be prefixed NEXT_PUBLIC_. It is read on
 * the server and is not part of the browser bundle.
 *
 * No seed fallback for the tables themselves. If the schema is missing the page
 * must say so rather than silently rendering content that the database cannot
 * save: a fallback that looks like live data is worse than an error, because
 * every write then appears to work and none of them persist.
 */

import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let sb;
function db() {
  if (!URL || !KEY) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    );
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
  'brand_assets',
  'site_blocks',
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

/* tables that carry a visibility column. activation_support does not. */
const SCOPED = new Set([
  'brand_assets',
  'projects',
  'project_links',
  'tasks',
  'activations',
  'series',
  'ideas',
  'social_ideas',
  'quotes',
  'decks',
]);

/**
 * The client scope, applied on top of the database.
 *
 *   adam  the studio. everything, including internal rows.
 *   cy    Central Yards. shared rows only, and quotes only once confirmed.
 *
 * An unknown or missing scope is treated as 'cy'. Failing closed means a bug in
 * the gate withholds draft material rather than publishing it.
 */
export function scopeRows(table, rows, scope) {
  if (scope === 'adam') return rows;
  return rows.filter((r) => {
    if (SCOPED.has(table) && r.visibility === 'internal') return false;
    if (table === 'quotes' && r.status !== 'confirmed') return false;
    /* The client's to-do is what they owe and what Adam owes them, not the
       studio's own working list. A task Adam is doing internally carries
       owner_side 'adam'; one that needs a CY decision carries 'central_yards'
       or 'both'. */
    if (table === 'tasks' && r.owner_side === 'adam') return false;
    return true;
  });
}

export async function loadWorkspace(scope = 'cy') {
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

  const out = { source: 'supabase', scope: scope === 'adam' ? 'adam' : 'cy' };
  TABLES.forEach((t, i) => {
    out[t] = scopeRows(t, results[i].data || [], scope);
  });

  /* an uploaded asset lives in a private bucket, so it opens through a short
     signed URL minted here, per request. External links pass through as they
     are: their access is governed by Drive, Dropbox or Figma, not by us. */
  out.brand_assets = await Promise.all(
    out.brand_assets.map(async (a) => {
      if (a.storage_kind !== 'supabase' || !a.storage_path) return a;
      const { data, error } = await client.storage.from('brand').createSignedUrl(a.storage_path, 300);
      return { ...a, url: error ? '' : data?.signedUrl || '', signed: !error };
    })
  );

  /* the kit of parts: only the blocks this site has switched on */
  out.blocks = (out.site_blocks || [])
    .filter((b) => b.enabled)
    .sort((a, b) => (a.position || 0) - (b.position || 0))
    .map((b) => b.block_key);
  return out;
}

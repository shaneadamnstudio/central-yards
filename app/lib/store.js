/**
 * Persistence. Supabase is the only store.
 *
 * There is deliberately no file fallback. Supply Co. learned that a second
 * source of truth makes the first one look broken: a write that lands in a
 * local file while the database holds something else means two devices show
 * two different truths and neither is wrong. If the database cannot be
 * reached, the write fails loudly instead.
 *
 * Every write reads the row back before reporting success, because a PostgREST
 * update with no matching grant returns 200 and zero rows affected.
 */

import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let sb;
function db() {
  if (!URL || !KEY) throw new Error('Supabase is not configured');
  if (!sb) {
    sb = createClient(URL, KEY, {
      auth: { persistSession: false },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
    });
  }
  return sb;
}

export async function readState() {
  const client = db();
  const [tasksRes, actsRes] = await Promise.all([
    client.from('tasks').select('id,status'),
    client.from('activations').select('id,start_date,end_date'),
  ]);

  if (tasksRes.error) throw new Error(tasksRes.error.message);
  if (actsRes.error) throw new Error(actsRes.error.message);

  const tasks = {};
  (tasksRes.data || []).forEach((r) => { tasks[r.id] = r.status; });

  const placements = {};
  (actsRes.data || []).forEach((r) => {
    placements[r.id] = { start_date: r.start_date, end_date: r.end_date };
  });

  return { tasks, placements, backend: 'supabase' };
}

/**
 * patch shapes:
 *   { tasks:      { [taskId]: 'done' | 'open' | 'doing' | 'blocked' } }
 *   { placements: { [activationId]: { start_date, end_date } } }
 *
 * Returns { ok, backend } or throws. It never reports success for a write that
 * did not change a row.
 */
export async function patchState(patch) {
  const client = db();

  for (const [id, status] of Object.entries(patch.tasks || {})) {
    const { error } = await client.from('tasks').update({ status }).eq('id', id);
    if (error) throw new Error(`task ${id}: ${error.message}`);

    /* read back: a 200 with zero rows affected is the silent failure */
    const { data, error: readErr } = await client
      .from('tasks').select('status').eq('id', id).maybeSingle();
    if (readErr) throw new Error(`task ${id} read back: ${readErr.message}`);
    if (!data) throw new Error(`task ${id} did not exist`);
    if (data.status !== status) throw new Error(`task ${id} did not take the new status`);
  }

  for (const [id, p] of Object.entries(patch.placements || {})) {
    const { error } = await client
      .from('activations')
      .update({ start_date: p.start_date, end_date: p.end_date || null })
      .eq('id', id);
    if (error) throw new Error(`activation ${id}: ${error.message}`);

    const { data, error: readErr } = await client
      .from('activations').select('start_date').eq('id', id).maybeSingle();
    if (readErr) throw new Error(`activation ${id} read back: ${readErr.message}`);
    if (!data) throw new Error(`activation ${id} did not exist`);
    if (data.start_date !== p.start_date) throw new Error(`activation ${id} did not move`);
  }

  return { ok: true, backend: 'supabase' };
}

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
 *
 * Writes go through this server module with the SERVICE key, not from the
 * browser with the publishable one. That is what lets an internal task be
 * ticked at all: the anon UPDATE policy requires visibility = 'shared', so with
 * the public key every internal row was read-only to everybody. The scope check
 * below replaces what the policy was doing, and it fails closed.
 *
 * SUPABASE_SERVICE_ROLE_KEY must never be prefixed NEXT_PUBLIC_.
 */

import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

/* a row the call may touch. adam sees everything, cy sees shared rows only. */
function visible(row, scope) {
  if (!row) return false;
  if (scope === 'adam') return true;
  return row.visibility !== 'internal';
}

export async function readState(scope = 'cy') {
  const client = db();
  const [tasksRes, actsRes] = await Promise.all([
    client.from('tasks').select('id,status,visibility'),
    client.from('activations').select('id,start_date,end_date,visibility'),
  ]);

  if (tasksRes.error) throw new Error(tasksRes.error.message);
  if (actsRes.error) throw new Error(actsRes.error.message);

  const tasks = {};
  (tasksRes.data || []).filter((r) => visible(r, scope)).forEach((r) => {
    tasks[r.id] = r.status;
  });

  const placements = {};
  (actsRes.data || []).filter((r) => visible(r, scope)).forEach((r) => {
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
 *
 * Scope is enforced per row, before the write. With the service key the database
 * no longer refuses anything, so this is the check that stops a Central Yards
 * session changing a row it cannot see.
 */
export async function patchState(patch, scope = 'cy') {
  const client = db();

  for (const [id, status] of Object.entries(patch.tasks || {})) {
    const { data: row, error: readErr } = await client
      .from('tasks').select('id,visibility').eq('id', id).maybeSingle();
    if (readErr) throw new Error(`task ${id} read: ${readErr.message}`);
    if (!row) throw new Error(`task ${id} did not exist`);
    if (!visible(row, scope)) throw new Error(`task ${id} is not available to this session`);

    const { error } = await client.from('tasks').update({ status }).eq('id', id);
    if (error) throw new Error(`task ${id}: ${error.message}`);

    /* read back: a 200 with zero rows affected is the silent failure */
    const { data, error: readBackErr } = await client
      .from('tasks').select('status').eq('id', id).maybeSingle();
    if (readBackErr) throw new Error(`task ${id} read back: ${readBackErr.message}`);
    if (!data) throw new Error(`task ${id} did not exist`);
    if (data.status !== status) throw new Error(`task ${id} did not take the new status`);
  }

  for (const [id, p] of Object.entries(patch.placements || {})) {
    const { data: row, error: readErr } = await client
      .from('activations').select('id,visibility').eq('id', id).maybeSingle();
    if (readErr) throw new Error(`activation ${id} read: ${readErr.message}`);
    if (!row) throw new Error(`activation ${id} did not exist`);
    if (!visible(row, scope)) throw new Error(`activation ${id} is not available to this session`);

    const { error } = await client
      .from('activations')
      .update({ start_date: p.start_date, end_date: p.end_date || null })
      .eq('id', id);
    if (error) throw new Error(`activation ${id}: ${error.message}`);

    const { data, error: readBackErr } = await client
      .from('activations').select('start_date').eq('id', id).maybeSingle();
    if (readBackErr) throw new Error(`activation ${id} read back: ${readBackErr.message}`);
    if (!data) throw new Error(`activation ${id} did not exist`);
    if (data.start_date !== p.start_date) throw new Error(`activation ${id} did not move`);
  }

  return { ok: true, backend: 'supabase' };
}

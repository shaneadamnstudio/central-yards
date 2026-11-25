/**
 * Persistence for the two things users write: task completion and activation
 * placement.
 *
 * Supabase is the store. The file fallback exists so the app still runs before
 * the schema has been applied: if the tables are missing, or the network is
 * down, writes go to data/state.json instead of vanishing. Every caller gets
 * told which happened, because a write that silently goes nowhere is the bug
 * that hid for days on the Supply Co. build.
 *
 * Requires sql/002_live_schema.sql to have been applied to the project.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const STORE = path.join(process.cwd(), 'data', 'state.json');
const EMPTY = { tasks: {}, placements: {}, updatedAt: null, backend: 'none' };

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let sb;
function db() {
  if (!URL || !KEY) return null;
  if (!sb) sb = createClient(URL, KEY, { auth: { persistSession: false } });
  return sb;
}

/* ---------- file fallback ---------- */
async function readFile() {
  try {
    const raw = await fs.readFile(STORE, 'utf8');
    const parsed = JSON.parse(raw);
    return { ...EMPTY, ...parsed, backend: 'file' };
  } catch (e) {
    if (e && e.code === 'ENOENT') return { ...EMPTY, backend: 'file' };
    throw e;
  }
}

async function writeFile(next) {
  await fs.mkdir(path.dirname(STORE), { recursive: true });
  const body = JSON.stringify({ ...next, updatedAt: new Date().toISOString() }, null, 2);
  const tmp = STORE + '.tmp';
  await fs.writeFile(tmp, body, 'utf8');
  await fs.rename(tmp, STORE);
  return { ...next, backend: 'file' };
}

/* ---------- public ---------- */

export async function readState() {
  const client = db();
  if (client) {
    const [tasksRes, actsRes] = await Promise.all([
      client.from('tasks').select('id,status'),
      client.from('activations').select('id,start_date,end_date'),
    ]);

    if (!tasksRes.error && !actsRes.error) {
      const tasks = {};
      (tasksRes.data || []).forEach((r) => { tasks[r.id] = r.status; });
      const placements = {};
      (actsRes.data || []).forEach((r) => {
        placements[r.id] = { start_date: r.start_date, end_date: r.end_date };
      });
      return { tasks, placements, updatedAt: null, backend: 'supabase' };
    }

    /* table missing or unreachable: fall through rather than break the page */
    const why = (tasksRes.error && tasksRes.error.message) || (actsRes.error && actsRes.error.message);
    console.warn('[store] supabase read failed, using file:', why);
  }
  return readFile();
}

/**
 * patch shapes:
 *   { tasks:      { [taskId]: 'done' | 'open' } }
 *   { placements: { [activationId]: { start_date, end_date } } }
 */
export async function patchState(patch) {
  const client = db();
  if (client) {
    const errors = [];

    for (const [id, status] of Object.entries(patch.tasks || {})) {
      const { error } = await client.from('tasks').update({ status }).eq('id', id);
      if (error) errors.push(`tasks ${id}: ${error.message}`);
    }

    for (const [id, p] of Object.entries(patch.placements || {})) {
      const { error } = await client
        .from('activations')
        .update({ start_date: p.start_date, end_date: p.end_date || null })
        .eq('id', id);
      if (error) errors.push(`activations ${id}: ${error.message}`);
    }

    if (!errors.length) {
      /* read back before claiming success */
      const check = await readState();
      if (check.backend === 'supabase') {
        const tasksOk = Object.entries(patch.tasks || {}).every(([k, v]) => check.tasks[k] === v);
        if (tasksOk) return { ok: true, backend: 'supabase' };
      }
      return { ok: false, error: 'Write did not read back' };
    }

    console.warn('[store] supabase write failed, using file:', errors.join('; '));
  }

  /* file fallback keeps the app usable before the schema lands */
  const current = await readFile();
  const next = {
    ...current,
    tasks: { ...current.tasks, ...(patch.tasks || {}) },
    placements: { ...current.placements, ...(patch.placements || {}) },
  };
  await writeFile(next);
  return { ok: true, backend: 'file' };
}

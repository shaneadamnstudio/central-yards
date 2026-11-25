/**
 * Persistence for the two things users write: task completion and
 * activation placement.
 *
 * Deliberately storage-agnostic. Right now it writes to a JSON file on the
 * server so a checkbox survives a reload and a drag survives a refresh. When
 * the Supabase project exists, only this file changes: `read` and `write`
 * start calling PostgREST against `tasks` and `activations`. Nothing above
 * this layer needs to know.
 *
 * Kept server-side rather than in localStorage for one reason: Supply Co.
 * learned that browser-only state means two people see two different truths.
 */

import { promises as fs } from 'fs';
import path from 'path';

const STORE = path.join(process.cwd(), 'data', 'state.json');

const EMPTY = { tasks: {}, placements: {}, updatedAt: null };

async function ensureDir() {
  await fs.mkdir(path.dirname(STORE), { recursive: true });
}

export async function readState() {
  try {
    const raw = await fs.readFile(STORE, 'utf8');
    const parsed = JSON.parse(raw);
    return { ...EMPTY, ...parsed };
  } catch (e) {
    /* a missing file is not an error, it is an untouched workspace */
    if (e && e.code === 'ENOENT') return { ...EMPTY };
    throw e;
  }
}

export async function writeState(next) {
  await ensureDir();
  const body = JSON.stringify({ ...next, updatedAt: new Date().toISOString() }, null, 2);
  /* write then rename, so a crash mid-write cannot leave a truncated file */
  const tmp = STORE + '.tmp';
  await fs.writeFile(tmp, body, 'utf8');
  await fs.rename(tmp, STORE);
  return next;
}

/* merge patch shapes so two writes do not clobber each other */
export async function patchState(patch) {
  const current = await readState();
  const next = {
    ...current,
    tasks: { ...current.tasks, ...(patch.tasks || {}) },
    placements: { ...current.placements, ...(patch.placements || {}) },
  };
  /* a null value means remove the key, matching the row-absence rule */
  Object.keys(next.tasks).forEach((k) => { if (next.tasks[k] === null) delete next.tasks[k]; });
  Object.keys(next.placements).forEach((k) => { if (next.placements[k] === null) delete next.placements[k]; });
  return writeState(next);
}

'use client';

import { useState, useCallback } from 'react';

/**
 * Writes that survive a reload.
 *
 * The browser sends a patch and reports a failure loudly rather than
 * pretending the change stuck. Supply Co. shipped a silent catch that hid a
 * broken archive write for days; that is not repeated here.
 */
export default function useWrite(setError) {
  const [busy, setBusy] = useState({});

  const write = useCallback(async (patch, key) => {
    setBusy((b) => ({ ...b, [key]: true }));
    try {
      const res = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Save failed (${res.status})`);
      return true;
    } catch (e) {
      if (setError) setError(`Could not save: ${e.message}`);
      return false;
    } finally {
      setBusy((b) => {
        const next = { ...b };
        delete next[key];
        return next;
      });
    }
  }, [setError]);

  return { write, busy };
}

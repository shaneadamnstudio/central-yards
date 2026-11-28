'use client';

import { useState } from 'react';
import useReveal from '../useReveal';
import Masthead from '../Masthead';

/**
 * Brand assets for the site's client.
 *
 * Generic by design: it reads `data.brand_assets`, groups by `kind`, and knows
 * nothing about Central Yards. The next site gets this view unchanged, pointed
 * at its own rows.
 *
 * An asset is one of:
 *   supabase  an uploaded file, opened through a signed URL minted per request
 *   drive / dropbox / link  an external link, access governed by that service
 *
 * A missing group is shown rather than hidden, with a line saying what belongs
 * there. An empty box is a prompt to supply the file; a blank space looks like
 * a bug.
 */

const GROUPS = [
  { kind: 'brand_book', name: 'Brand book', note: 'The written system: who the brand is and how it behaves.' },
  { kind: 'colour', name: 'Colours', note: 'The palette, with values that can be used.' },
  { kind: 'guideline', name: 'Guidelines', note: 'Rules for type, layout, tone and usage.' },
  { kind: 'video', name: 'Videos and films', note: 'Brand films and campaigns, finished or in folder.' },
  { kind: 'logo', name: 'Logos', note: 'Approved marks, in the formats people need.' },
  { kind: 'other', name: 'Other', note: 'Anything else the client should have to hand.' },
];

function Swatch({ asset }) {
  const hex = (asset.value || '').trim();
  return (
    <div className="ba-card ba-swatch">
      <span className="ba-chip" style={{ background: hex || 'transparent' }} aria-hidden="true" />
      <div>
        <h4>{asset.title}</h4>
        <p className="ba-meta">{asset.subtitle || hex}</p>
        {hex ? <code className="ba-hex">{hex}</code> : null}
      </div>
    </div>
  );
}

const KINDS = ['brand_book', 'colour', 'guideline', 'video', 'logo', 'other'];
const KIND_LABEL = {
  brand_book: 'Brand book', colour: 'Colour', guideline: 'Guideline',
  video: 'Video or film', logo: 'Logo', other: 'Other',
};

/** Studio-only upload. The API refuses a client scope regardless of this
    button, so hiding it is tidiness rather than the control. */
function Uploader({ onUploaded }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(''); setDone('');
    const fd = new FormData(e.currentTarget);
    try {
      const r = await fetch('/api/assets/upload', { method: 'POST', body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `Upload failed (${r.status})`);
      setDone(`${d.asset?.title || 'File'} filed`);
      onUploaded(d.asset);
      e.currentTarget.reset();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="ba-upload">
        <button className="btn btn-sm" onClick={() => setOpen(true)}>Add a brand asset</button>
        {done ? <span className="ba-ok">{done}</span> : null}
      </div>
    );
  }

  return (
    <form className="ba-form" onSubmit={submit}>
      <div className="ba-form-row">
        <label>
          <span>Kind</span>
          <select name="kind" defaultValue="logo" required>
            {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
        </label>
        <label className="grow">
          <span>Title</span>
          <input name="title" required placeholder="Primary mark" />
        </label>
        <label className="grow">
          <span>Note</span>
          <input name="subtitle" placeholder="SVG, light and dark" />
        </label>
        <label>
          <span>Who sees it</span>
          <select name="visibility" defaultValue="shared">
            <option value="shared">Shared with the client</option>
            <option value="internal">Internal only</option>
          </select>
        </label>
      </div>
      <div className="ba-form-row">
        <label className="grow">
          <span>File</span>
          <input type="file" name="file" required />
        </label>
        <button className="btn btn-sm" type="submit" disabled={busy}>
          {busy ? 'Uploading' : 'Upload'}
        </button>
        <button className="btn btn-sm" type="button" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </button>
      </div>
      <p className="ba-note">
        PDF, image, SVG, MP4, MOV, ZIP or a font. 50 MB. Files land in the private brand bucket and
        open through a five minute signed link.
      </p>
      {error ? <p className="ba-err">{error}</p> : null}
      {done ? <p className="ba-ok">{done}</p> : null}
    </form>
  );
}

export default function Brand({ data, isAdam }) {
  const [added, setAdded] = useState([]);
  const assets = [...(data.brand_assets || []), ...added];
  const revealRef = useReveal([assets.length]);

  const byKind = (kind) => assets
    .filter((a) => a.kind === kind)
    .sort((a, b) => (a.position || 0) - (b.position || 0));

  return (
    <>
      <Masthead
        eyebrow="Brand assets"
        title="Everything the brand is made of, in one place"
        lede={
          <>
            Brand books, colours, guidelines, films and logos for this client. Uploaded files open
            through a short-lived signed link. Linked files open in Drive, Dropbox or Figma, where
            access is governed by that service.
          </>
        }
        count={assets.length}
        countLabel="Assets"
      />

      {isAdam ? <Uploader onUploaded={(a) => a && setAdded((x) => [...x, a])} /> : null}

      <div className="ba-wrap" ref={revealRef}>
        {GROUPS.map((g) => {
          const rows = byKind(g.kind);
          return (
            <section key={g.kind} className="ba-group reveal">
              <div className="ba-head">
                <h3>{g.name}</h3>
                <span>{rows.length ? `${rows.length} filed` : 'nothing filed yet'}</span>
              </div>
              <p className="ba-note">{g.note}</p>

              {rows.length === 0 ? (
                <div className="ba-empty">
                  Nothing here yet. Supply the file and it will be listed with the rest.
                </div>
              ) : (
                <div className="ba-grid">
                  {rows.map((a) => (
                    a.kind === 'colour' ? (
                      <Swatch key={a.id} asset={a} />
                    ) : (
                      <a
                        key={a.id}
                        className="ba-card"
                        href={a.url || '#'}
                        target="_blank"
                        rel="noreferrer"
                        title={a.url ? 'Open' : 'No link yet'}
                      >
                        <div className="ba-top">
                          <h4>{a.title}</h4>
                          {a.format ? <span className="ba-format">{a.format}</span> : null}
                        </div>
                        {a.subtitle ? <p className="ba-meta">{a.subtitle}</p> : null}
                        <div className="ba-foot">
                          <span>{a.storage_kind === 'supabase' ? (a.signed ? 'Signed link, 5 minutes' : 'File unavailable') : a.storage_kind}</span>
                          {a.visibility === 'internal' ? <span className="chip chip-internal">Internal</span> : null}
                          <span className="ba-open">{a.url ? 'Open' : 'Pending'}</span>
                        </div>
                      </a>
                    )
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

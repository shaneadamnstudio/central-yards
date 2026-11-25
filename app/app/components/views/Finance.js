'use client';

import { useState, useEffect, useRef } from 'react';
import Masthead from '../Masthead';
import useReveal from '../useReveal';

const STATUS = [
  { key: 'submitted', name: 'Submitted', color: 'var(--tan)' },
  { key: 'reviewed', name: 'Reviewed', color: 'var(--standard)' },
  { key: 'confirmed', name: 'Confirmed', color: '#1a7a4a' },
  { key: 'on_hold', name: 'On Hold', color: 'var(--rapid)' },
];

const DOC_TYPES = ['receipt', 'invoice', 'statement', 'other'];
const RECEIPT_STATUS = [
  { key: 'filed', name: 'Filed' },
  { key: 'claimed', name: 'Claimed' },
  { key: 'reimbursed', name: 'Reimbursed' },
  { key: 'void', name: 'Void' },
];

function money(n, cur) {
  if (n === null || n === undefined || n === '') return '—';
  return `${cur || 'HKD'} ${Number(n).toLocaleString('en-HK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function bytes(n) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}
function when(s) {
  if (!s) return '';
  return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function Finance({ data, open }) {
  const { quotes, projects } = data;
  const [tab, setTab] = useState('quotes');
  const [status, setStatus] = useState('all');
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const revealRef = useReveal([status, tab]);

  const projName = (id) => (projects.find((p) => p.id === id) || {}).name || '';

  async function loadReceipts() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/receipts', { cache: 'no-store' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || `Could not load receipts (${res.status})`);
      setReceipts(d.receipts || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (tab === 'receipts' && receipts.length === 0) loadReceipts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const shownQuotes = status === 'all' ? quotes : quotes.filter((q) => q.status === status);

  const filter = (
    <>
      <button className={tab === 'quotes' ? 'on' : ''} onClick={() => setTab('quotes')}>
        Quotes<em>{quotes.length}</em>
      </button>
      <button className={tab === 'receipts' ? 'on' : ''} onClick={() => setTab('receipts')}>
        Receipts<em>{receipts.length || ''}</em>
      </button>
    </>
  );

  return (
    <>
      <Masthead
        eyebrow="Central Yards — Finance"
        title="Quotations, receipts and invoices"
        lede={
          <>
            Every quote ties to its project with who is reviewing it and where it stands.
            Receipts and invoices can be filed against a project too, so the paper trail sits
            with the work instead of in someone&apos;s inbox.
          </>
        }
        count={tab === 'quotes' ? quotes.length : receipts.length}
        countLabel={tab === 'quotes' ? 'Quotes in flight' : 'Documents filed'}
        filter={filter}
      />

      {error ? <div className="note-strip" style={{ borderLeftColor: 'var(--rapid)', color: 'var(--rapid)' }}>{error}</div> : null}
      {notice ? <div className="note-strip">{notice}</div> : null}

      {tab === 'quotes' ? (
        <>
          <div className="tabs">
            <button className={'tab' + (status === 'all' ? ' on' : '')} onClick={() => setStatus('all')}>
              All<span className="tab-n">{quotes.length}</span>
            </button>
            {STATUS.map((s) => (
              <button key={s.key} className={'tab' + (status === s.key ? ' on' : '')} onClick={() => setStatus(s.key)}>
                {s.name}<span className="tab-n">{quotes.filter((q) => q.status === s.key).length || ''}</span>
              </button>
            ))}
          </div>

          {shownQuotes.length === 0 ? (
            <div className="empty">
              <h3>No quotes in this view</h3>
              <p>A quote links to its project and carries a reviewer and a status.</p>
            </div>
          ) : (
            <table className="tbl" ref={revealRef}>
              <thead>
                <tr>
                  <th>Quote</th><th>Project</th><th className="num">Amount</th>
                  <th>Reviewer</th><th>Status</th><th>Link</th>
                </tr>
              </thead>
              <tbody>
                {shownQuotes.map((q) => {
                  const st = STATUS.find((s) => s.key === q.status);
                  return (
                    <tr key={q.id} className="reveal">
                      <td>
                        <div className="t-title">{q.title}</div>
                        {q.reference ? <div className="t-sub">{q.reference}</div> : null}
                      </td>
                      <td>
                        {q.project_id && projName(q.project_id) ? (
                          <button
                            onClick={() => open('project', q.project_id)}
                            style={{ background: 'none', border: 0, padding: 0, fontSize: 13.5, borderBottom: '1px solid var(--rule)' }}
                          >
                            {projName(q.project_id)}
                          </button>
                        ) : <span style={{ color: 'var(--faint)' }}>None</span>}
                      </td>
                      <td className="num">{money(q.amount, q.currency)}</td>
                      <td>{q.reviewer || <span style={{ color: 'var(--faint)' }}>Unassigned</span>}</td>
                      <td><span className="chip" style={{ borderLeftColor: st?.color }}>{st?.name || q.status}</span></td>
                      <td>{q.quote_url ? <a href={q.quote_url} target="_blank" rel="noreferrer">Open quote</a> : <span style={{ color: 'var(--faint)' }}>—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      ) : (
        <Receipts
          receipts={receipts}
          loading={loading}
          projects={projects}
          projName={projName}
          onUploaded={(msg) => { setNotice(msg); loadReceipts(); }}
          onError={setError}
          revealRef={revealRef}
        />
      )}
    </>
  );
}

/* ---------- receipts ---------- */
function Receipts({ receipts, loading, projects, projName, onUploaded, onError, revealRef }) {
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef(null);
  const [form, setForm] = useState({
    title: '', vendor: '', amount: '', currency: 'HKD',
    doc_type: 'receipt', project_id: '', issued_date: '', note: '',
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function upload(files) {
    const file = files && files[0];
    if (!file) return;

    setBusy(true);
    onError('');
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('title', form.title || file.name.replace(/\.[^.]+$/, ''));
      body.append('vendor', form.vendor);
      body.append('amount', form.amount);
      body.append('currency', form.currency);
      body.append('doc_type', form.doc_type);
      body.append('project_id', form.project_id);
      body.append('issued_date', form.issued_date);
      body.append('note', form.note);

      const res = await fetch('/api/receipts/upload', { method: 'POST', body });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || `Upload failed (${res.status})`);

      setForm({ title: '', vendor: '', amount: '', currency: 'HKD', doc_type: 'receipt', project_id: '', issued_date: '', note: '' });
      if (fileRef.current) fileRef.current.value = '';
      onUploaded(`Filed ${(d.receipt && d.receipt.file_name) || file.name}.`);
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
      setDragging(false);
    }
  }

  return (
    <>
      <div className="receipt-form">
        <div className="card" style={{ padding: '14px 16px' }}>
          <p className="eyebrow" style={{ margin: '0 0 12px' }}>Details</p>

          <div className="field">
            <label>Title</label>
            <input value={form.title} onChange={set('title')} placeholder="Leave blank to use the filename" />
          </div>

          <div className="field-row">
            <div className="field">
              <label>Type</label>
              <select value={form.doc_type} onChange={set('doc_type')}>
                {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Date on document</label>
              <input type="date" value={form.issued_date} onChange={set('issued_date')} />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Vendor</label>
              <input value={form.vendor} onChange={set('vendor')} placeholder="Who was paid" />
            </div>
            <div className="field">
              <label>Amount</label>
              <input value={form.amount} onChange={set('amount')} inputMode="decimal" placeholder="0.00" />
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Currency</label>
              <input value={form.currency} onChange={set('currency')} />
            </div>
            <div className="field">
              <label>Project</label>
              <select value={form.project_id} onChange={set('project_id')}>
                <option value="">No project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          <div className="field">
            <label>Note</label>
            <textarea value={form.note} onChange={set('note')} rows={2} />
          </div>
        </div>

        <div
          className={'upload-drop' + (dragging ? ' upload-drop-over' : '')}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files); }}
        >
          <svg className="upload-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 16V4m0 0L7 9m5-5 5 5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" />
            <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" />
          </svg>
          <p className="upload-title">Drop a file here</p>
          <p className="upload-sub">PDF, a photo of a receipt, or a spreadsheet. Up to 10 MB.</p>
          <input
            ref={fileRef}
            type="file"
            id="receipt-file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.tif,.tiff,.xlsx,.xls"
            onChange={(e) => upload(e.target.files)}
            style={{ display: 'none' }}
          />
          <button
            className="btn"
            disabled={busy}
            onClick={() => fileRef.current && fileRef.current.click()}
            style={{ marginTop: 14 }}
          >
            {busy ? 'Uploading' : 'Choose a file'}
          </button>
          <p className="upload-note">
            Files are private. They open through a link that expires in five minutes.
          </p>
        </div>
      </div>

      <div className="section-label">Filed documents · {receipts.length}</div>

      {loading ? (
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>Loading.</p>
      ) : receipts.length === 0 ? (
        <div className="empty">
          <h3>No receipts filed yet</h3>
          <p>
            Drop a receipt or invoice above. Each one carries its vendor, amount and project,
            so at the end of a month the spend is already sorted rather than in a folder.
          </p>
        </div>
      ) : (
        <table className="tbl" ref={revealRef}>
          <thead>
            <tr>
              <th>Document</th><th>Vendor</th><th className="num">Amount</th>
              <th>Project</th><th>Date</th><th>Status</th><th>File</th>
            </tr>
          </thead>
          <tbody>
            {receipts.map((r) => {
              const st = RECEIPT_STATUS.find((s) => s.key === r.status);
              return (
                <tr key={r.id} className="reveal">
                  <td>
                    <div className="t-title">{r.title}</div>
                    <div className="t-sub">{r.doc_type} · {bytes(r.file_size)}</div>
                  </td>
                  <td>{r.vendor || <span style={{ color: 'var(--faint)' }}>—</span>}</td>
                  <td className="num">{money(r.amount, r.currency)}</td>
                  <td>{r.project_id && projName(r.project_id) ? projName(r.project_id) : <span style={{ color: 'var(--faint)' }}>None</span>}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{r.issued_date ? when(r.issued_date) : <span style={{ color: 'var(--faint)' }}>—</span>}</td>
                  <td><span className="chip chip-internal">{st?.name || r.status}</span></td>
                  <td>
                    {r.signed_url
                      ? <a href={r.signed_url} target="_blank" rel="noreferrer">Open</a>
                      : <span style={{ color: 'var(--faint)' }}>Unavailable</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}

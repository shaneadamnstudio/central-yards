'use client';

import { useState, useMemo } from 'react';

const STATUS = [
  { key: 'submitted', name: 'Submitted', color: '#a08967' },
  { key: 'reviewed', name: 'Reviewed', color: '#1a4f8a' },
  { key: 'confirmed', name: 'Confirmed', color: '#0f7a4a' },
  { key: 'on_hold', name: 'On Hold', color: '#7a1f2b' },
];

function money(n, cur) {
  if (n === null || n === undefined || n === '') return '';
  return `${cur || 'HKD'} ${Number(n).toLocaleString('en-HK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function Finance({ data, open, isAdam }) {
  const { quotes, projects } = data;
  const [status, setStatus] = useState('all');

  const projName = useMemo(() => {
    const m = {};
    projects.forEach((p) => { m[p.id] = p.name; });
    return m;
  }, [projects]);

  const shown = useMemo(
    () => (status === 'all' ? quotes : quotes.filter((q) => q.status === status)),
    [quotes, status]
  );

  const byStatus = (k) => quotes.filter((q) => q.status === k).length;

  return (
    <>
      <div className="head">
        <div>
          <h1>Finance</h1>
          <p>
            Quotations and invoices, each tied to its project. The current quote link, who
            is reviewing it and where it stands, so nothing waits on a chase email.
          </p>
        </div>
      </div>

      <div className="tabs">
        <button className={'tab' + (status === 'all' ? ' on' : '')} onClick={() => setStatus('all')}>
          All<span className="tab-n">{quotes.length}</span>
        </button>
        {STATUS.map((s) => (
          <button key={s.key} className={'tab' + (status === s.key ? ' on' : '')} onClick={() => setStatus(s.key)}>
            {s.name}
            {byStatus(s.key) ? <span className="tab-n">{byStatus(s.key)}</span> : null}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="empty">
          <h3>No quotes yet</h3>
          <p>
            A quote links to its project and carries a reviewer and a status: Submitted,
            Reviewed, Confirmed or On Hold. Draft quotes stay internal until you share them.
          </p>
        </div>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>Quote</th>
              <th>Project</th>
              <th className="num">Amount</th>
              <th>Reviewer</th>
              <th>Status</th>
              <th>Link</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((q) => {
              const st = STATUS.find((s) => s.key === q.status);
              return (
                <tr key={q.id}>
                  <td>
                    <div className="t-title">{q.title}</div>
                    {q.reference ? <div className="t-sub">{q.reference}</div> : null}
                  </td>
                  <td>
                    {q.project_id && projName[q.project_id] ? (
                      <button
                        onClick={() => open('project', q.project_id)}
                        style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', fontSize: 12.5, color: 'var(--blue)' }}
                      >
                        {projName[q.project_id]}
                      </button>
                    ) : <span style={{ color: 'var(--ink-40)' }}>None</span>}
                  </td>
                  <td className="num">{money(q.amount, q.currency)}</td>
                  <td>{q.reviewer || <span style={{ color: 'var(--ink-40)' }}>Unassigned</span>}</td>
                  <td>
                    <span className="chip" style={{ background: (st?.color || '#999') + '18', color: st?.color }}>
                      {st?.name || q.status}
                    </span>
                  </td>
                  <td>
                    {q.quote_url ? <a href={q.quote_url} target="_blank" rel="noreferrer">Open quote</a> : <span style={{ color: 'var(--ink-40)' }}>None</span>}
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

'use client';

import { useState, useMemo } from 'react';
import Masthead from '../Masthead';

const STATUS = [
  { key: 'submitted', name: 'Submitted', color: 'var(--tan)' },
  { key: 'reviewed', name: 'Reviewed', color: 'var(--standard)' },
  { key: 'confirmed', name: 'Confirmed', color: '#1a7a4a' },
  { key: 'on_hold', name: 'On Hold', color: 'var(--rapid)' },
];

function money(n, cur) {
  if (n === null || n === undefined || n === '') return '—';
  return `${cur || 'HKD'} ${Number(n).toLocaleString('en-HK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function Finance({ data, open }) {
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

  const total = quotes.reduce((s, q) => s + (Number(q.amount) || 0), 0);

  const filter = (
    <>
      <button className={status === 'all' ? 'on' : ''} onClick={() => setStatus('all')}>
        Everything<em>{quotes.length}</em>
      </button>
      {STATUS.map((s) => (
        <button key={s.key} className={status === s.key ? 'on' : ''} onClick={() => setStatus(s.key)}>
          {s.name}<em>{quotes.filter((q) => q.status === s.key).length}</em>
        </button>
      ))}
    </>
  );

  return (
    <>
      <Masthead
        eyebrow="Central Yards — Finance"
        title="Quotations and where each one stands"
        lede={
          <>
            Every quote ties to its project and carries the current link, who is reviewing it
            and one of four states: <b>Submitted</b>, <b>Reviewed</b>, <b>Confirmed</b> or
            <b> On Hold</b>. Draft quotes stay internal until you share them.
          </>
        }
        count={quotes.length}
        countLabel={`Quotes, ${total ? money(total, 'HKD') : 'no value yet'}`}
        filter={filter}
      />

      {shown.length === 0 ? (
        <div className="empty">
          <h3>No quotes in this view</h3>
          <p>
            A quote links to its project and carries a reviewer and a status. Draft quotes
            stay internal until you share them with Central Yards.
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
                        style={{ background: 'none', border: 0, padding: 0, fontSize: 13.5, borderBottom: '1px solid var(--rule)' }}
                      >
                        {projName[q.project_id]}
                      </button>
                    ) : <span style={{ color: 'var(--faint)' }}>None</span>}
                  </td>
                  <td className="num">{money(q.amount, q.currency)}</td>
                  <td>{q.reviewer || <span style={{ color: 'var(--faint)' }}>Unassigned</span>}</td>
                  <td>
                    <span className="chip" style={{ borderLeftColor: st?.color }}>{st?.name || q.status}</span>
                  </td>
                  <td>
                    {q.quote_url ? <a href={q.quote_url} target="_blank" rel="noreferrer">Open quote</a> : <span style={{ color: 'var(--faint)' }}>—</span>}
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

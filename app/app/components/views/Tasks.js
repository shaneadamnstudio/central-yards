'use client';

import { useState, useMemo } from 'react';

const TABS = [
  { key: 'everyone', name: 'Everyone' },
  { key: 'adam', name: 'ADAM' },
  { key: 'central_yards', name: 'Central Yards' },
];

function daysUntil(d) {
  if (!d) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((new Date(d + 'T00:00:00') - now) / 86400000);
}

function fmt(d) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export default function Tasks({ data, open, isAdam }) {
  const { tasks, projects } = data;
  const [who, setWho] = useState('everyone');
  const [showDone, setShowDone] = useState(false);

  const projName = useMemo(() => {
    const m = {};
    projects.forEach((p) => { m[p.id] = p.name; });
    return m;
  }, [projects]);

  const filtered = useMemo(() => {
    let rows = tasks;
    if (who !== 'everyone') {
      rows = rows.filter((t) => t.owner_side === who || t.owner_side === 'both');
    }
    if (!showDone) rows = rows.filter((t) => t.status !== 'done');
    return rows.slice().sort((a, b) => {
      const da = a.due_date ? new Date(a.due_date) : new Date(8640000000000000);
      const db = b.due_date ? new Date(b.due_date) : new Date(8640000000000000);
      return da - db;
    });
  }, [tasks, who, showDone]);

  const countFor = (k) => {
    const rows = k === 'everyone' ? tasks : tasks.filter((t) => t.owner_side === k || t.owner_side === 'both');
    return rows.filter((t) => t.status !== 'done').length;
  };

  return (
    <>
      <div className="head">
        <div>
          <h1>To-do</h1>
          <p>
            One list, filtered by who owns it. Every task carries its owner, due date and
            the project it belongs to. These come from the shared tracker, so a task is
            updated once and shows correctly for both teams.
          </p>
        </div>
        <div className="head-actions">
          <button className="btn btn-sm" onClick={() => setShowDone((s) => !s)}>
            {showDone ? 'Hide done' : 'Show done'}
          </button>
        </div>
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={'tab' + (who === t.key ? ' on' : '')} onClick={() => setWho(t.key)}>
            {t.name}
            <span className="tab-n">{countFor(t.key)}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <h3>No tasks in this view</h3>
          <p>
            Tasks come from your ClickUp and Google Sheet tracker. Once the sync is on,
            each task shows here with an owner, a due date and its project. Nothing is
            duplicated, so a change in the tracker is a change here.
          </p>
        </div>
      ) : (
        <table className="tbl">
          <thead>
            <tr>
              <th>Task</th>
              <th>Owner</th>
              <th>Project</th>
              <th>Due</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
              const d = daysUntil(t.due_date);
              const late = d !== null && d < 0 && t.status !== 'done';
              return (
                <tr key={t.id}>
                  <td>
                    <div className="t-title">{t.title}</div>
                    {t.awaiting_from ? <div className="t-sub">Awaiting {t.awaiting_from}</div> : null}
                  </td>
                  <td>
                    <span className={`chip ${t.owner_side === 'central_yards' ? 'chip-cy' : 'chip-adam'}`}>
                      {t.owner_name || (t.owner_side === 'central_yards' ? 'CY' : 'ADAM')}
                    </span>
                  </td>
                  <td>
                    {t.project_id && projName[t.project_id] ? (
                      <button
                        onClick={() => open('project', t.project_id)}
                        style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', fontSize: 12.5, textAlign: 'left', color: 'var(--blue)' }}
                      >
                        {projName[t.project_id]}
                      </button>
                    ) : (
                      <span style={{ color: 'var(--ink-40)' }}>None</span>
                    )}
                  </td>
                  <td className={late ? 'overdue' : ''} style={{ whiteSpace: 'nowrap' }}>
                    {t.due_date ? fmt(t.due_date) : 'No date'}
                    {late ? ` (${Math.abs(d)}d late)` : ''}
                  </td>
                  <td>
                    <span className={`chip ${t.status === 'done' ? 'chip-done' : t.status === 'blocked' ? 'chip-blocked' : ''}`}>
                      {t.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {t.link_url ? <a href={t.link_url} target="_blank" rel="noreferrer">Open</a> : null}
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

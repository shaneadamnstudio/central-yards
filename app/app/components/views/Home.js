'use client';

import { useMemo } from 'react';

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d + (d.length === 10 ? 'T00:00:00' : ''));
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function daysUntil(d) {
  if (!d) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const t = new Date(d + 'T00:00:00');
  return Math.round((t - now) / 86400000);
}

export default function Home({ data, isAdam, counts, open }) {
  const { config, activations, tasks, projects, series } = data;

  /* ---------- awaiting review: tasks that name who owes the next action ---------- */
  const awaiting = useMemo(() => {
    return tasks
      .filter((t) => t.status !== 'done' && (t.awaiting_from || t.link_url))
      .sort((a, b) => {
        const da = a.due_date ? new Date(a.due_date) : new Date(8640000000000000);
        const db = b.due_date ? new Date(b.due_date) : new Date(8640000000000000);
        return da - db;
      })
      .slice(0, 8);
  }, [tasks]);

  /* ---------- upcoming milestones: activations and dated tasks, next out ---------- */
  const milestones = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const out = [];

    activations.forEach((a) => {
      const d = new Date(a.start_date + 'T00:00:00');
      if (d >= today) {
        out.push({ date: a.start_date, title: a.title, tag: 'Activation', id: a.id, type: 'activation' });
      }
    });

    projects.forEach((p) => {
      (p.key_dates || []).forEach((k) => {
        if (!k.date) return;
        const d = new Date(k.date + 'T00:00:00');
        if (d >= today) out.push({ date: k.date, title: `${p.name}: ${k.label}`, tag: 'Project date', id: p.id, type: 'project' });
      });
      if (p.next_action_due) {
        const d = new Date(p.next_action_due + 'T00:00:00');
        if (d >= today) out.push({ date: p.next_action_due, title: `${p.name}: ${p.next_action || 'next action'}`, tag: 'Next action', id: p.id, type: 'project' });
      }
    });

    return out.sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 8);
  }, [activations, projects]);

  const openTasks = tasks.filter((t) => t.status !== 'done');
  const overdue = openTasks.filter((t) => daysUntil(t.due_date) < 0);

  return (
    <>
      <div className="head">
        <div>
          <h1>Central Yards x Adam Studios</h1>
          <p>{config?.meta?.tagline || 'One workspace for activations, projects, tasks and pitches.'}</p>
        </div>
        <div className="head-actions">
          <span className={`chip ${isAdam ? 'chip-adam' : 'chip-cy'}`}>
            {isAdam ? 'ADAM: internal visible' : 'Shared with Central Yards'}
          </span>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="stat-n">{counts.projects}</div>
          <div className="stat-l">Projects</div>
        </div>
        <div className="stat">
          <div className="stat-n">{openTasks.length}</div>
          <div className="stat-l">Open tasks{overdue.length ? `, ${overdue.length} late` : ''}</div>
        </div>
        <div className="stat">
          <div className="stat-n">{counts.activations}</div>
          <div className="stat-l">Activations</div>
        </div>
        <div className="stat">
          <div className="stat-n">{counts.finance}</div>
          <div className="stat-l">Quotes in flight</div>
        </div>
      </div>

      <div className="home-grid">
        <section>
          <div className="section-label">Awaiting review</div>
          <div className="card">
            {awaiting.length === 0 ? (
              <div style={{ padding: '10px 0', fontSize: 12.5, color: 'var(--ink-60)' }}>
                Nothing is waiting on a review right now. Items appear here when a task names
                who owes the next action, for example Conversations feedback.
              </div>
            ) : (
              awaiting.map((t) => {
                const late = daysUntil(t.due_date) !== null && daysUntil(t.due_date) < 0;
                return (
                  <div key={t.id} className="review-row">
                    <span
                      className="review-dot"
                      style={{ background: late ? 'var(--red)' : t.awaiting_from ? 'var(--tan)' : 'var(--green)' }}
                    />
                    <div className="review-main">
                      <p className="review-title">{t.title}</p>
                      <div className="review-meta">
                        {t.awaiting_from ? <span>Owed by {t.awaiting_from}</span> : null}
                        {t.owner_name ? <span className={`chip ${t.owner_side === 'central_yards' ? 'chip-cy' : 'chip-adam'}`}>{t.owner_name}</span> : null}
                        {t.link_url ? (
                          <a className="review-link" href={t.link_url} target="_blank" rel="noreferrer">
                            Open the doc
                          </a>
                        ) : null}
                      </div>
                    </div>
                    <div className={'review-when' + (late ? ' late' : '')}>
                      {t.due_date ? (late ? `Overdue ${fmtDate(t.due_date)}` : `Due ${fmtDate(t.due_date)}`) : 'No date'}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="section-label">Upcoming milestones</div>
          <div className="card">
            {milestones.length === 0 ? (
              <div style={{ padding: '10px 0', fontSize: 12.5, color: 'var(--ink-60)' }}>
                No dated milestones yet. Projects and activations with dates show here first.
              </div>
            ) : (
              milestones.map((m, i) => (
                <div
                  key={m.type + m.id + i}
                  className="mile-row"
                  style={{ cursor: 'pointer' }}
                  onClick={() => open(m.type, m.id)}
                >
                  <span className="mile-date">{fmtDate(m.date)}</span>
                  <span className="mile-title">{m.title}</span>
                  <span className="mile-tag">{m.tag}</span>
                </div>
              ))
            )}
          </div>
        </section>

        <aside>
          <div className="section-label">Series running</div>
          <div className="card">
            {(series || []).length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--ink-60)' }}>No series set.</div>
            ) : (
              series.map((s) => (
                <div key={s.id} className="mile-row" style={{ gap: 10 }}>
                  <span className="review-dot" style={{ background: s.colour || 'var(--tan)', marginTop: 5 }} />
                  <span className="mile-title">{s.name}</span>
                  <span className="mile-tag">{s.cadence}</span>
                </div>
              ))
            )}
          </div>

          <div className="section-label">Next activation</div>
          <div className="card">
            {activations.length === 0 ? (
              <div style={{ fontSize: 12.5, color: 'var(--ink-60)' }}>No activations yet.</div>
            ) : (
              (() => {
                const a = activations.slice().sort((x, y) => new Date(x.start_date) - new Date(y.start_date))[0];
                const d = daysUntil(a.start_date);
                return (
                  <button
                    onClick={() => open('activation', a.id)}
                    style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer', width: '100%' }}
                  >
                    <div style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.35, marginBottom: 5 }}>{a.title}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-60)' }}>
                      {fmtDate(a.start_date)}
                      {d !== null ? `, ${d > 0 ? `in ${d} days` : 'live now'}` : ''}
                    </div>
                    {a.pitch_room ? <span className="chip" style={{ marginTop: 8 }}>ADAM pitch room</span> : null}
                  </button>
                );
              })()
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

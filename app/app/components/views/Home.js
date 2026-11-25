'use client';

import { useMemo } from 'react';
import Masthead from '../Masthead';

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d + (d.length === 10 ? 'T00:00:00' : ''));
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function daysUntil(d) {
  if (!d) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((new Date(d + 'T00:00:00') - now) / 86400000);
}

export default function Home({ data, isAdam, counts, open }) {
  const { activations, tasks, projects, series } = data;

  const awaiting = useMemo(
    () => tasks
      .filter((t) => t.status !== 'done' && (t.awaiting_from || t.link_url))
      .sort((a, b) => {
        const da = a.due_date ? new Date(a.due_date) : new Date(8640000000000000);
        const db = b.due_date ? new Date(b.due_date) : new Date(8640000000000000);
        return da - db;
      })
      .slice(0, 8),
    [tasks]
  );

  const milestones = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const out = [];
    activations.forEach((a) => {
      if (new Date(a.start_date + 'T00:00:00') >= today) {
        out.push({ date: a.start_date, title: a.title, tag: 'Activation', id: a.id, type: 'activation' });
      }
    });
    projects.forEach((p) => {
      (p.key_dates || []).forEach((k) => {
        if (k.date && new Date(k.date + 'T00:00:00') >= today) {
          out.push({ date: k.date, title: `${p.name}: ${k.label}`, tag: 'Project', id: p.id, type: 'project' });
        }
      });
      if (p.next_action_due && new Date(p.next_action_due + 'T00:00:00') >= today) {
        out.push({ date: p.next_action_due, title: `${p.name}: ${p.next_action || 'next action'}`, tag: 'Next action', id: p.id, type: 'project' });
      }
    });
    return out.sort((a, b) => new Date(a.date) - new Date(b.date)).slice(0, 8);
  }, [activations, projects]);

  const openTasks = tasks.filter((t) => t.status !== 'done');
  const overdue = openTasks.filter((t) => daysUntil(t.due_date) < 0);
  const nextAct = activations.slice().sort((x, y) => new Date(x.start_date) - new Date(y.start_date))[0];

  return (
    <>
      <Masthead
        eyebrow={`Central Yards — ${isAdam ? 'ADAM Studios' : 'shared workspace'}`}
        title="Activations, projects and what is owed next"
        lede={
          <>
            One workspace for the 2027 activation map, the project pipeline and every task
            that carries an owner. <b>{openTasks.length} open</b> across both teams
            {overdue.length ? <>, <b>{overdue.length} past due</b></> : null}.
          </>
        }
        count={openTasks.length}
        countLabel="Open tasks"
      />

      <div className="home-grid">
        <section>
          <div className="section-label">Awaiting review</div>
          {awaiting.length === 0 ? (
            <div className="empty">
              <h3>Nothing waiting on a review</h3>
              <p>
                Items appear here when a task names who owes the next action, for example
                Conversations feedback, with the date and a direct link to the document.
              </p>
            </div>
          ) : (
            awaiting.map((t) => {
              const late = daysUntil(t.due_date) !== null && daysUntil(t.due_date) < 0;
              return (
                <div key={t.id} className="review-row">
                  <span className="review-dot" style={{ background: late ? 'var(--rapid)' : t.awaiting_from ? 'var(--tan)' : '#1a7a4a' }} />
                  <div className="review-main">
                    <p className="review-title">{t.title}</p>
                    <div className="review-meta">
                      {t.awaiting_from ? <span>Owed by {t.awaiting_from}</span> : null}
                      {t.owner_name ? <span className={`chip ${t.owner_side === 'central_yards' ? 'chip-cy' : 'chip-adam'}`}>{t.owner_name}</span> : null}
                      {t.link_url ? <a className="review-link" href={t.link_url} target="_blank" rel="noreferrer">Open the doc</a> : null}
                    </div>
                  </div>
                  <div className={'review-when' + (late ? ' late' : '')}>
                    {t.due_date ? (late ? `Overdue ${fmtDate(t.due_date)}` : `Due ${fmtDate(t.due_date)}`) : 'No date'}
                  </div>
                </div>
              );
            })
          )}

          <div className="section-label">Upcoming milestones</div>
          {milestones.length === 0 ? (
            <div className="empty">
              <h3>No dated milestones yet</h3>
              <p>Projects and activations with dates appear here first, nearest first.</p>
            </div>
          ) : (
            milestones.map((m, i) => (
              <div key={m.type + m.id + i} className="mile-row" style={{ cursor: 'pointer' }} onClick={() => open(m.type, m.id)}>
                <span className="mile-date">{fmtDate(m.date)}</span>
                <span className="mile-title">{m.title}</span>
                <span className="mile-tag">{m.tag}</span>
              </div>
            ))
          )}
        </section>

        <aside>
          <div className="section-label">Next activation</div>
          {nextAct ? (
            <button
              onClick={() => open('activation', nextAct.id)}
              style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', width: '100%' }}
            >
              <div style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.25, marginBottom: 6, letterSpacing: '-.015em' }}>
                {nextAct.title}
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)' }}>
                {fmtDate(nextAct.start_date)}
                {daysUntil(nextAct.start_date) !== null ? `, in ${daysUntil(nextAct.start_date)} days` : ''}
              </div>
              {nextAct.pitch_room ? <span className="chip" style={{ marginTop: 10 }}>Pitch room open</span> : null}
            </button>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>No activations dated yet.</p>
          )}

          <div className="section-label">Series running</div>
          {(series || []).length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>No series set.</p>
          ) : (
            series.map((s) => (
              <div key={s.id} className="mile-row" style={{ gap: 10 }}>
                <span className="review-dot" style={{ background: s.colour || 'var(--tan)', marginTop: 6 }} />
                <span className="mile-title">{s.name}</span>
                <span className="mile-tag">{s.cadence}</span>
              </div>
            ))
          )}
        </aside>
      </div>
    </>
  );
}

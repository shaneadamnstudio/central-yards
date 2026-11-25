'use client';

import { useMemo } from 'react';

const TIER = {
  rapid: { name: 'Rapid', color: 'var(--rapid)' },
  standard: { name: 'Standard', color: 'var(--standard)' },
  big_ideas: { name: 'Big Ideas', color: 'var(--dream)' },
  big_umbrella: { name: 'Big Umbrella', color: 'var(--art)' },
};
const QS = {
  submitted: { name: 'Submitted', color: 'var(--tan)' },
  reviewed: { name: 'Reviewed', color: 'var(--standard)' },
  confirmed: { name: 'Confirmed', color: '#1a7a4a' },
  on_hold: { name: 'On Hold', color: 'var(--rapid)' },
};

export default function Drawer({ sel, ctx, onClose }) {
  const { data } = ctx;
  const { projects, tasks, project_links, activations, activation_support, ideas, social_ideas, quotes, decks, series } = data;

  const content = useMemo(() => {
    const { type, id } = sel;

    if (type === 'project') {
      const p = projects.find((x) => x.id === id);
      if (!p) return { title: 'Not found' };
      const links = project_links.filter((l) => l.project_id === id);
      const open = tasks.filter((t) => t.project_id === id && t.status !== 'done');
      const qs = quotes.filter((q) => q.project_id === id);
      const dk = decks.filter((d) => d.project_id === id).sort((a, b) => Number(b.is_current) - Number(a.is_current));
      const acts = activation_support.filter((a) => a.project_id === id)
        .map((a) => activations.find((x) => x.id === a.activation_id)).filter(Boolean);
      const tier = TIER[p.tier];

      return {
        eyebrow: p.lane === 'special' ? 'Special Projects' : 'General Central Yards Projects',
        title: p.name,
        chips: [
          tier ? { label: tier.name, color: tier.color } : null,
          p.visibility === 'internal' ? { label: 'Internal', cls: 'chip-internal' } : { label: 'Shared', cls: 'chip-shared' },
        ].filter(Boolean),
        body: (
          <>
            {p.summary ? <p className="drawer-sub">{p.summary}</p> : null}

            <div className="field-row">
              <div className="field">
                <label>Status</label>
                <div style={{ fontSize: 13.5 }}>{p.status || 'active'}</div>
              </div>
              <div className="field">
                <label>Owner</label>
                <div style={{ fontSize: 13.5 }}>
                  {p.owner_name || 'Unassigned'}
                  {p.owner_side ? (
                    <span className={`chip ${p.owner_side === 'central_yards' ? 'chip-cy' : 'chip-adam'}`} style={{ marginLeft: 7 }}>
                      {p.owner_side === 'central_yards' ? 'CY' : 'ADAM'}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="field">
              <label>Next action</label>
              <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>
                {p.next_action || 'None set'}
                {p.next_action_due ? <span style={{ color: 'var(--faint)' }}>, due {p.next_action_due}</span> : null}
              </div>
            </div>

            {(p.key_dates || []).length > 0 ? (
              <div className="field">
                <label>Key dates</label>
                {(p.key_dates || []).map((k, i) => (
                  <div key={i} className="link-row">
                    <span className="link-kind">{k.date}</span>
                    <span style={{ flex: 1 }}>{k.label}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="field">
              <label>Documents and links · {links.length}</label>
              {links.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                  No links yet. Google Docs, decks and working files attach here.
                </div>
              ) : (
                links.map((l) => (
                  <div key={l.id} className="link-row">
                    <span className="link-kind">{l.kind}</span>
                    <a href={l.url} target="_blank" rel="noreferrer">{l.label}</a>
                    {l.visibility === 'internal' ? <span className="chip chip-internal">Internal</span> : null}
                  </div>
                ))
              )}
            </div>

            {open.length > 0 ? (
              <div className="field">
                <label>Open tasks · {open.length}</label>
                {open.map((t) => (
                  <div key={t.id} className="link-row">
                    <span style={{ flex: 1 }}>{t.title}</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)' }}>
                      {t.due_date || 'no date'}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            {dk.length > 0 ? (
              <div className="field">
                <label>Decks</label>
                {dk.map((d) => (
                  <div key={d.id} className="link-row">
                    <span className="link-kind">{d.is_current ? 'current' : d.version || 'old'}</span>
                    <a href={d.url} target="_blank" rel="noreferrer">{d.title}</a>
                  </div>
                ))}
              </div>
            ) : null}

            {qs.length > 0 ? (
              <div className="field">
                <label>Quotes</label>
                {qs.map((q) => {
                  const s = QS[q.status];
                  return (
                    <div key={q.id} className="link-row">
                      <span className="link-kind" style={{ color: s?.color }}>{s?.name}</span>
                      <span style={{ flex: 1 }}>{q.title}</span>
                      {q.quote_url ? <a href={q.quote_url} target="_blank" rel="noreferrer">Open</a> : null}
                    </div>
                  );
                })}
              </div>
            ) : null}

            {acts.length > 0 ? (
              <div className="field">
                <label>Supports</label>
                {acts.map((a) => (
                  <div key={a.id} className="link-row">
                    <span className="link-kind">{a.start_date}</span>
                    <span style={{ flex: 1 }}>{a.title}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ),
      };
    }

    if (type === 'activation') {
      const a = activations.find((x) => x.id === id);
      if (!a) return { title: 'Not found' };
      const supporting = activation_support.filter((s) => s.activation_id === id)
        .map((s) => projects.find((p) => p.id === s.project_id)).filter(Boolean);
      const s = series.find((x) => x.id === a.series_id);

      return {
        eyebrow: a.audience === 'central_yards' ? 'Central Yards activation' : a.audience === 'adam' ? 'ADAM work' : 'Joint moment',
        title: a.title,
        chips: a.pitch_room ? [{ label: 'Pitch room open', color: 'var(--tan)' }] : [],
        body: (
          <>
            {a.detail ? <p className="drawer-sub">{a.detail}</p> : null}

            <div className="field">
              <label>Dates</label>
              <div style={{ fontSize: 13.5 }}>
                {a.start_date}{a.end_date && a.end_date !== a.start_date ? ` to ${a.end_date}` : ''}
              </div>
            </div>

            {s ? (
              <div className="field">
                <label>Series</label>
                <div style={{ fontSize: 13.5 }}>{s.name}, {s.cadence}</div>
              </div>
            ) : null}

            <div className="field">
              <label>Projects supporting this</label>
              {supporting.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>No project linked yet.</div>
              ) : (
                supporting.map((p) => <div key={p.id} className="link-row"><span style={{ flex: 1 }}>{p.name}</span></div>)
              )}
            </div>

            {a.pitch_room ? (
              <div className="field">
                <label>Room to pitch</label>
                <div style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--muted)' }}>
                  {a.pitch_note || 'ADAM has room to pitch an idea into this moment.'}
                </div>
              </div>
            ) : null}
          </>
        ),
      };
    }

    if (type === 'idea') {
      const i = ideas.find((x) => x.id === id);
      if (!i) return { title: 'Not found' };
      const p = projects.find((x) => x.id === i.link_project);
      const a = activations.find((x) => x.id === i.link_activation);
      return {
        eyebrow: 'Partnerships and ideas',
        title: i.title,
        chips: [
          { label: i.kind },
          i.visibility === 'internal' ? { label: 'Internal', cls: 'chip-internal' } : { label: 'Shared', cls: 'chip-shared' },
        ],
        body: (
          <>
            {i.detail ? <p className="drawer-sub">{i.detail}</p> : null}
            <div className="field">
              <label>Status</label>
              <div style={{ fontSize: 13.5 }}>{i.status || 'idea'}</div>
            </div>
            <div className="field">
              <label>Linked to</label>
              <div style={{ fontSize: 13.5, lineHeight: 1.9 }}>
                {p ? <div>Project · {p.name}</div> : null}
                {a ? <div>Activation · {a.title}</div> : null}
                {!p && !a ? <span style={{ color: 'var(--faint)' }}>Not linked yet</span> : null}
              </div>
            </div>
          </>
        ),
      };
    }

    if (type === 'social') {
      const s = social_ideas.find((x) => x.id === id);
      if (!s) return { title: 'Not found' };
      return {
        eyebrow: 'Social',
        title: s.title,
        chips: [{ label: s.status }, s.theme ? { label: s.theme } : null].filter(Boolean),
        body: (
          <>
            {s.body ? <p className="drawer-sub">{s.body}</p> : null}
            <div className="field">
              <label>Visibility</label>
              <div style={{ fontSize: 13.5 }}>
                {s.visibility === 'internal' ? 'Internal, ADAM only' : 'Shared with Central Yards'}
              </div>
            </div>
          </>
        ),
      };
    }

    return { title: 'Unknown item' };
  }, [sel, projects, tasks, project_links, activations, activation_support, ideas, social_ideas, quotes, decks, series]);

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true">
        <div className="panel-head">
          <div>
            {content.eyebrow ? <p className="eyebrow" style={{ margin: '0 0 8px' }}>{content.eyebrow}</p> : null}
            <h2>{content.title}</h2>
            {content.chips && content.chips.length ? (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                {content.chips.map((c, i) => (
                  <span key={i} className={`chip ${c.cls || ''}`} style={c.color ? { borderLeftColor: c.color } : undefined}>
                    {c.label}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="panel-body">{content.body}</div>
      </aside>
    </>
  );
}

'use client';

import { useState, useMemo } from 'react';

const TIER = {
  rapid: { name: 'Rapid', color: '#0f7a4a' },
  standard: { name: 'Standard', color: '#a08967' },
  big_ideas: { name: 'Big Ideas', color: '#1a4f8a' },
  big_umbrella: { name: 'Big Umbrella', color: '#7a1f2b' },
};

export default function Projects({ data, config, open, isAdam }) {
  const { projects, project_links, tasks } = data;
  const [tier, setTier] = useState('all');

  const lanes = config?.lanes || [
    { key: 'general', name: 'General Central Yards Projects', sub: 'Ongoing work' },
    { key: 'special', name: 'Special Projects', sub: 'Standalone initiatives leading into 2027' },
  ];

  const shown = useMemo(
    () => (tier === 'all' ? projects : projects.filter((p) => p.tier === tier)),
    [projects, tier]
  );

  const countFor = (p) => ({
    links: project_links.filter((l) => l.project_id === p.id).length,
    open: tasks.filter((t) => t.project_id === p.id && t.status !== 'done').length,
  });

  return (
    <>
      <div className="head">
        <div>
          <h1>Projects</h1>
          <p>
            The pipeline, carried over from your tracker. Rapid, Standard, Big Ideas and
            Big Umbrella labels are kept so a project reads the same way it does today.
          </p>
        </div>
      </div>

      <div className="tabs">
        <button className={'tab' + (tier === 'all' ? ' on' : '')} onClick={() => setTier('all')}>
          All<span className="tab-n">{projects.length}</span>
        </button>
        {Object.entries(TIER).map(([k, v]) => {
          const n = projects.filter((p) => p.tier === k).length;
          return (
            <button key={k} className={'tab' + (tier === k ? ' on' : '')} onClick={() => setTier(k)}>
              {v.name}
              {n ? <span className="tab-n">{n}</span> : null}
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <div className="empty">
          <h3>No projects yet</h3>
          <p>
            Projects arrive from your ClickUp and Google Sheet tracker. Once the sync is
            connected they appear here with their links, owner, key dates and next action.
            Nothing is invented in the meantime.
          </p>
        </div>
      ) : (
        lanes.map((lane) => {
          const inLane = shown.filter((p) => p.lane === lane.key);
          if (inLane.length === 0) return null;
          return (
            <div key={lane.key} className="lane-block">
              <div className="lane-head">
                <h2>{lane.name}</h2>
                <span>{lane.sub}</span>
                <span style={{ marginLeft: 'auto', fontSize: 10 }}>
                  {inLane.length} project{inLane.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="proj-grid">
                {inLane.map((p) => {
                  const c = countFor(p);
                  const t = TIER[p.tier];
                  return (
                    <button
                      key={p.id}
                      className="proj"
                      style={{ borderTopColor: t?.color || 'var(--tan)' }}
                      onClick={() => open('project', p.id)}
                    >
                      <div className="proj-top">
                        <h3 className="proj-name">{p.name}</h3>
                        {p.visibility === 'internal' ? <span className="chip chip-internal">Internal</span> : null}
                      </div>
                      {p.summary ? <p className="proj-sum">{p.summary}</p> : null}
                      <div className="proj-meta">
                        {t ? <span className="chip" style={{ background: t.color + '18', color: t.color }}>{t.name}</span> : null}
                        {p.owner_name ? <span>{p.owner_name}</span> : null}
                        {c.links ? <span>{c.links} link{c.links === 1 ? '' : 's'}</span> : null}
                        {c.open ? <span>{c.open} open</span> : null}
                      </div>
                      {p.next_action ? (
                        <div className="proj-next">
                          Next: <strong>{p.next_action}</strong>
                          {p.next_action_due ? `, ${p.next_action_due}` : ''}
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </>
  );
}

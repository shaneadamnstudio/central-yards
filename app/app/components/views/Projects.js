'use client';

import { useState, useMemo } from 'react';
import Masthead from '../Masthead';

const TIER = {
  rapid: { name: 'Rapid', color: 'var(--rapid)' },
  standard: { name: 'Standard', color: 'var(--standard)' },
  big_ideas: { name: 'Big Ideas', color: 'var(--dream)' },
  big_umbrella: { name: 'Big Umbrella', color: 'var(--art)' },
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

  const filter = (
    <>
      <button className={tier === 'all' ? 'on' : ''} onClick={() => setTier('all')}>
        Everything<em>{projects.length}</em>
      </button>
      {Object.entries(TIER).map(([k, v]) => (
        <button key={k} className={tier === k ? 'on' : ''} onClick={() => setTier(k)}>
          {v.name}
          <em>{projects.filter((p) => p.tier === k).length}</em>
        </button>
      ))}
    </>
  );

  return (
    <>
      <Masthead
        eyebrow="Central Yards — Pipeline"
        title="Projects"
        lede={
          <>
            The pipeline, carried over from your tracker. Labels stay as they are today:
            <b> Rapid</b>, <b>Standard</b>, <b>Big Ideas</b> and <b>Big Umbrella</b>, sorted
            into two lanes. Each project holds its own links, owner, key dates and next action.
          </>
        }
        count={projects.length}
        countLabel="Projects in flight"
        filter={filter}
      />

      {shown.length === 0 ? (
        <div className="empty">
          <h3>No projects in this view</h3>
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
                <span>{lane.sub} · {inLane.length}</span>
              </div>
              <div className="proj-grid">
                {inLane.map((p) => {
                  const links = project_links.filter((l) => l.project_id === p.id).length;
                  const openN = tasks.filter((t) => t.project_id === p.id && t.status !== 'done').length;
                  const t = TIER[p.tier];
                  return (
                    <button key={p.id} className="proj" onClick={() => open('project', p.id)} style={{ '--accent': t?.color || 'var(--tan)' }}>
                      <div className="proj-top">
                        <h3 className="proj-name">{p.name}</h3>
                        {p.visibility === 'internal' ? <span className="chip chip-internal">Internal</span> : null}
                      </div>
                      {p.summary ? <p className="proj-sum">{p.summary}</p> : null}
                      <div className="proj-meta">
                        {t ? <span>{t.name}</span> : null}
                        {p.owner_name ? <span>{p.owner_name}</span> : null}
                        {links ? <span>{links} link{links === 1 ? '' : 's'}</span> : null}
                        {openN ? <span>{openN} open</span> : null}
                      </div>
                      {p.next_action ? (
                        <div className="proj-next">
                          Next: <strong>{p.next_action}</strong>
                          {p.next_action_due ? `, ${p.next_action_due}` : ''}
                        </div>
                      ) : null}
                      <span className="bar" />
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

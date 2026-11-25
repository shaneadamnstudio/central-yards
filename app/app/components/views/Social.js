'use client';

import { useState, useMemo } from 'react';

const STAGES = [
  { key: 'dump', name: 'Brain dump', color: '#8a8273' },
  { key: 'developing', name: 'Developing', color: '#a08967' },
  { key: 'ready', name: 'Ready to discuss', color: '#1a4f8a' },
  { key: 'shared', name: 'Shared with CY', color: '#0f7a4a' },
];

export default function Social({ data, open, isAdam }) {
  const { social_ideas, projects } = data;
  const [stage, setStage] = useState('all');

  const shown = useMemo(
    () => (stage === 'all' ? social_ideas : social_ideas.filter((s) => s.status === stage)),
    [social_ideas, stage]
  );

  const byStage = (k) => social_ideas.filter((s) => s.status === k).length;

  if (!isAdam) {
    const shared = social_ideas.filter((s) => s.visibility === 'shared' || s.status === 'shared' || s.status === 'ready');
    return (
      <>
        <div className="head">
          <div>
            <h1>Social</h1>
            <p>Ideas ADAM has shared for discussion with Central Yards.</p>
          </div>
        </div>
        {shared.length === 0 ? (
          <div className="empty">
            <h3>Nothing shared yet</h3>
            <p>
              ADAM works up content themes here and shares the ones worth discussing.
              Shared ideas will appear on this page.
            </p>
          </div>
        ) : (
          <div className="idea-grid">
            {shared.map((s) => (
              <button key={s.id} className="idea" onClick={() => open('social', s.id)}>
                <h4>{s.title}</h4>
                {s.body ? <p>{s.body}</p> : null}
                <div className="idea-meta">
                  <span className="chip chip-shared">Shared for discussion</span>
                  {s.theme ? <span className="chip">{s.theme}</span> : null}
                  {s.channel ? <span className="chip">{s.channel}</span> : null}
                </div>
              </button>
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className="head">
        <div>
          <h1>Social</h1>
          <p>
            ADAM's space to brain-dump, develop content themes and work out how the Central
            Yards brand builds on social over time. Ideas stay internal until you mark one
            ready to discuss.
          </p>
        </div>
        <div className="head-actions">
          <span className="chip chip-internal">ADAM only</span>
        </div>
      </div>

      <div className="tabs">
        <button className={'tab' + (stage === 'all' ? ' on' : '')} onClick={() => setStage('all')}>
          All<span className="tab-n">{social_ideas.length}</span>
        </button>
        {STAGES.map((s) => (
          <button key={s.key} className={'tab' + (stage === s.key ? ' on' : '')} onClick={() => setStage(s.key)}>
            {s.name}
            {byStage(s.key) ? <span className="tab-n">{byStage(s.key)}</span> : null}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="empty">
          <h3>Nothing here yet</h3>
          <p>
            Drop raw thoughts first, the theme comes later. A note can start as one line
            and grow into a content pillar without leaving this page.
          </p>
        </div>
      ) : (
        <div className="idea-grid">
          {shown.map((s) => {
            const st = STAGES.find((x) => x.key === s.status);
            return (
              <button key={s.id} className="idea" onClick={() => open('social', s.id)}>
                <h4>{s.title}</h4>
                {s.body ? <p>{s.body}</p> : null}
                <div className="idea-meta">
                  {st ? <span className="chip" style={{ background: st.color + '18', color: st.color }}>{st.name}</span> : null}
                  {s.theme ? <span className="chip">{s.theme}</span> : null}
                  {s.channel ? <span className="chip">{s.channel}</span> : null}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

'use client';

import { useState, useMemo } from 'react';
import Masthead from '../Masthead';
import useReveal from '../useReveal';

const STAGES = [
  { key: 'dump', name: 'Brain dump', color: 'var(--faint)' },
  { key: 'developing', name: 'Developing', color: 'var(--tan)' },
  { key: 'ready', name: 'Ready', color: 'var(--standard)' },
  { key: 'shared', name: 'Shared', color: '#1a7a4a' },
];

export default function Social({ data, open, isAdam }) {
  const { social_ideas } = data;
  const [stage, setStage] = useState('all');
  const revealRef = useReveal([stage]);

  const shown = useMemo(
    () => (stage === 'all' ? social_ideas : social_ideas.filter((s) => s.status === stage)),
    [social_ideas, stage]
  );

  if (!isAdam) {
    const shared = social_ideas.filter((s) => s.visibility === 'shared' || s.status === 'shared' || s.status === 'ready');
    return (
      <>
        <Masthead
          eyebrow="Central Yards — Social"
          title="Content themes shared for discussion"
          lede={
            <>
              ADAM develops social thinking here and shares the ideas worth discussing.
              Anything not yet marked ready stays internal.
            </>
          }
          count={shared.length}
          countLabel="Shared ideas"
        />
        {shared.length === 0 ? (
          <div className="empty">
            <h3>Nothing shared yet</h3>
            <p>
              ADAM works up content themes here and shares the ones worth discussing.
              Shared ideas appear on this page.
            </p>
          </div>
        ) : (
          <div className="idea-grid" ref={revealRef}>
            {shared.map((s) => (
              <button key={s.id} className="idea reveal" onClick={() => open('social', s.id)}>
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

  const filter = (
    <>
      <button className={stage === 'all' ? 'on' : ''} onClick={() => setStage('all')}>
        Everything<em>{social_ideas.length}</em>
      </button>
      {STAGES.map((s) => (
        <button key={s.key} className={stage === s.key ? 'on' : ''} onClick={() => setStage(s.key)}>
          {s.name}<em>{social_ideas.filter((x) => x.status === s.key).length}</em>
        </button>
      ))}
    </>
  );

  return (
    <>
      <Masthead
        eyebrow="Central Yards — Social, ADAM only"
        title="Where the social thinking gets worked out"
        lede={
          <>
            A place to brain-dump, develop themes, and show how the Central Yards brand builds
            on social over time. Everything starts internal. When an idea is worth discussing,
            mark it ready and it appears on the Central Yards side.
          </>
        }
        count={social_ideas.length}
        countLabel="Ideas in the dump"
        filter={filter}
      />

      {shown.length === 0 ? (
        <div className="empty">
          <h3>Nothing here yet</h3>
          <p>
            Drop raw thoughts first, the theme comes later. A note can start as one line and
            grow into a content pillar without leaving this page.
          </p>
        </div>
      ) : (
        <div className="idea-grid" ref={revealRef}>
          {shown.map((s) => {
            const st = STAGES.find((x) => x.key === s.status);
            return (
              <button key={s.id} className="idea reveal" onClick={() => open('social', s.id)}>
                <h4>{s.title}</h4>
                {s.body ? <p>{s.body}</p> : null}
                <div className="idea-meta">
                  {st ? <span className="chip" style={{ borderLeftColor: st.color }}>{st.name}</span> : null}
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

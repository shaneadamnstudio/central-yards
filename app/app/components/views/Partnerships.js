'use client';

import { useState, useMemo } from 'react';
import Masthead from '../Masthead';
import useReveal from '../useReveal';

const KINDS = [
  { key: 'all', name: 'Everything' },
  { key: 'partner', name: 'Partners' },
  { key: 'concept', name: 'Concepts' },
  { key: 'product', name: 'Product ideas' },
  { key: 'event', name: 'Events' },
  { key: 'activation', name: 'Activations' },
];

export default function Partnerships({ data, open }) {
  const { ideas, projects, activations } = data;
  const [kind, setKind] = useState('all');
  const revealRef = useReveal([kind]);

  const shown = useMemo(
    () => (kind === 'all' ? ideas : ideas.filter((i) => i.kind === kind)),
    [ideas, kind]
  );

  const named = (id, list, key = 'name') => (list.find((x) => x.id === id) || {})[key];

  const filter = (
    <>
      {KINDS.map((k) => (
        <button key={k.key} className={kind === k.key ? 'on' : ''} onClick={() => setKind(k.key)}>
          {k.name}<em>{k.key === 'all' ? ideas.length : ideas.filter((i) => i.kind === k.key).length}</em>
        </button>
      ))}
    </>
  );

  return (
    <>
      <Masthead
        eyebrow="Central Yards — Partnerships and product ideas"
        title="Ideas before anything is decided"
        lede={
          <>
            Two kinds of idea sit here: <b>partners</b>, where a named brand could make the
            thing, and <b>in-house concepts</b>, where the thing exists and nobody is attached
            yet. Any idea can be linked to a project or a marketing moment, so nothing sits
            orphaned when a date firms up.
          </>
        }
        count={ideas.length}
        countLabel="Ideas on the table"
        filter={filter}
      />

      {shown.length === 0 ? (
        <div className="empty">
          <h3>No ideas captured yet</h3>
          <p>
            This is where partner names and in-house concepts go. Each one can carry a project
            link and an activation link, so when a moment firms up you can see which ideas
            were already built for it.
          </p>
        </div>
      ) : (
        <div className="idea-grid" ref={revealRef}>
          {shown.map((i) => (
            <button key={i.id} className="idea reveal" onClick={() => open('idea', i.id)}>
              <h4>{i.title}</h4>
              {i.detail ? <p>{i.detail}</p> : null}
              <div className="idea-meta">
                <span className="chip">{i.kind}</span>
                {i.visibility === 'internal' ? <span className="chip chip-internal">Internal</span> : null}
                {i.link_project ? <span className="chip chip-cy">{named(i.link_project, projects)}</span> : null}
                {i.link_activation ? <span className="chip chip-adam">{named(i.link_activation, activations, 'title')}</span> : null}
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

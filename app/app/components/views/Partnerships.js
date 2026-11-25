'use client';

import { useState, useMemo } from 'react';

const KINDS = [
  { key: 'all', name: 'All' },
  { key: 'partner', name: 'Partners' },
  { key: 'concept', name: 'Concepts' },
  { key: 'product', name: 'Product ideas' },
  { key: 'event', name: 'Events' },
  { key: 'activation', name: 'Activations' },
];

export default function Partnerships({ data, open, isAdam }) {
  const { ideas, projects, activations } = data;
  const [kind, setKind] = useState('all');

  const shown = useMemo(
    () => (kind === 'all' ? ideas : ideas.filter((i) => i.kind === kind)),
    [ideas, kind]
  );

  const named = (id, list, key = 'name') => (list.find((x) => x.id === id) || {})[key];

  return (
    <>
      <div className="head">
        <div>
          <h1>Partnerships &amp; Ideas</h1>
          <p>
            Potential partners and ADAM's own concepts for Central Yards: product and
            object ideas, events, activations. Anything here can be linked to a project or
            a marketing moment, so an idea never sits orphaned.
          </p>
        </div>
      </div>

      <div className="tabs">
        {KINDS.map((k) => {
          const n = ideas.filter((i) => i.kind === k.key || k.key === 'all').length;
          return (
            <button key={k.key} className={'tab' + (kind === k.key ? ' on' : '')} onClick={() => setKind(k.key)}>
              {k.name}
              {n ? <span className="tab-n">{n}</span> : null}
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <div className="empty">
          <h3>No ideas captured yet</h3>
          <p>
            This is where partner names and in-house concepts go. Each one can carry a
            project link and an activation link, so when a moment firms up you can see
            which ideas were already built for it.
          </p>
        </div>
      ) : (
        <div className="idea-grid">
          {shown.map((i) => (
            <button key={i.id} className="idea" onClick={() => open('idea', i.id)}>
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

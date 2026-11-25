'use client';

import { useMemo } from 'react';
import Masthead from '../Masthead';

export default function Decks({ data }) {
  const { decks, projects } = data;

  const groups = useMemo(() => {
    const map = new Map();
    decks.forEach((d) => {
      const key = d.project_id || '__none';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(d);
    });
    const projMap = {};
    projects.forEach((p) => { projMap[p.id] = p; });
    return Array.from(map.entries()).map(([key, list]) => ({
      key,
      name: key === '__none' ? 'Unassigned' : projMap[key]?.name || 'Unknown project',
      list: list.slice().sort((a, b) => Number(b.is_current) - Number(a.is_current)),
    }));
  }, [decks, projects]);

  return (
    <>
      <Masthead
        eyebrow="Central Yards — Decks and pitches"
        title="One index, so nobody presents last week's deck"
        lede={
          <>
            Every deck and pitch link, grouped by project. The current one is marked in the
            index and surfaced inside its project panel, so there is a single place to check
            before a meeting.
          </>
        }
        count={decks.length}
        countLabel="Decks indexed"
      />

      {groups.length === 0 ? (
        <div className="empty">
          <h3>No decks indexed yet</h3>
          <p>
            Add a deck or pitch link and choose its project. The current one is flagged in the
            index and inside the project, so there is one place to look.
          </p>
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.key} className="lane-block">
            <div className="lane-head">
              <h2>{g.name}</h2>
              <span>{g.list.length} item{g.list.length === 1 ? '' : 's'}</span>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Deck</th>
                  <th>Type</th>
                  <th>Version</th>
                  <th>Visibility</th>
                  <th>Link</th>
                </tr>
              </thead>
              <tbody>
                {g.list.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <div className="t-title">
                        {d.title}
                        {d.is_current ? <span className="chip chip-done" style={{ marginLeft: 8 }}>Current</span> : null}
                      </div>
                    </td>
                    <td>{d.deck_type}</td>
                    <td>{d.version || <span style={{ color: 'var(--faint)' }}>—</span>}</td>
                    <td>
                      <span className={`chip ${d.visibility === 'internal' ? 'chip-internal' : 'chip-shared'}`}>
                        {d.visibility || 'shared'}
                      </span>
                    </td>
                    <td><a href={d.url} target="_blank" rel="noreferrer">Open</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </>
  );
}

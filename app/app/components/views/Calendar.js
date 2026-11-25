'use client';

import { useState, useMemo } from 'react';

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
const MONTHS = { 1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr', 5: 'May', 6: 'Jun', 7: 'Jul', 8: 'Aug', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dec' };

function qOf(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return Math.floor(d.getMonth() / 3);
}

function short(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()} ${MONTHS[d.getMonth() + 1]}`;
}

const LAYERS = [
  { key: 'holiday', name: 'Public holidays' },
  { key: 'school', name: 'School holidays' },
  { key: 'cny', name: 'Lunar and festival run-up' },
  { key: 'custom', name: 'Recurring and key dates' },
  { key: 'typhoon', name: 'Typhoon season' },
];

export default function Calendar({ data, open, config }) {
  const { activations, series, calendar } = data;
  const now = new Date();
  const years = [2026, 2027, 2028];
  const defaultYear = years.includes(now.getFullYear() + 1) ? now.getFullYear() + 1 : 2027;
  const [year, setYear] = useState(defaultYear);
  const [on, setOn] = useState({ holiday: true, school: true, cny: true, custom: true, typhoon: false });

  const toggle = (k) => setOn((o) => ({ ...o, [k]: !o[k] }));

  const dates = useMemo(() => {
    const rows = (calendar?.dates || []).filter((d) => {
      const y = new Date(d.start + 'T00:00:00').getFullYear();
      return y === year && on[d.kind];
    });
    return rows;
  }, [calendar, year, on]);

  const acts = useMemo(
    () => (activations || []).filter((a) => new Date(a.start_date + 'T00:00:00').getFullYear() === year),
    [activations, year]
  );

  const buckets = useMemo(() => {
    const q = [[], [], [], []];
    acts.forEach((a) => q[qOf(a.start_date)].push(a));
    dates.forEach((d) => q[qOf(d.start)].push({ __date: true, ...d }));
    q.forEach((list) =>
      list.sort((x, y) => {
        const xs = x.__date ? x.start : x.start_date;
        const ys = y.__date ? y.start : y.start_date;
        return new Date(xs) - new Date(ys);
      })
    );
    return q;
  }, [acts, dates]);

  const seriesById = useMemo(() => {
    const m = {};
    (series || []).forEach((s) => { m[s.id] = s; });
    return m;
  }, [series]);

  const typhoonSeason = calendar?.typhoon?.season;

  return (
    <>
      <div className="head">
        <div>
          <h1>{year} activation map</h1>
          <p>
            Central Yards marketing activations and ADAM's related work on one calendar.
            Holiday and recurring layers sit underneath and toggle on and off.
          </p>
        </div>
      </div>

      <div className="cal-wrap">
        <div className="cal-toolbar">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            style={{ padding: '6px 10px', border: '1px solid var(--line)', background: '#fff', borderRadius: 2 }}
          >
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>

          {LAYERS.map((l) => (
            <label key={l.key} className={'layer-toggle' + (on[l.key] ? ' on' : '')}>
              <input type="checkbox" checked={on[l.key]} onChange={() => toggle(l.key)} />
              {l.name}
            </label>
          ))}

          <span className="spacer" />
          <span style={{ fontSize: 10.5, color: 'var(--ink-40)' }}>
            {acts.length} activation{acts.length === 1 ? '' : 's'}, {dates.length} calendar entr{dates.length === 1 ? 'y' : 'ies'}
          </span>
        </div>

        <div className="quarters">
          {QUARTERS.map((q, i) => (
            <div key={q} className="qcol">
              <div className="qhead">{q} {year}</div>
              <div className="qbody">
                {buckets[i].length === 0 ? (
                  <div style={{ fontSize: 10.5, color: 'var(--ink-40)', padding: '6px 4px' }}>Nothing placed</div>
                ) : null}

                {buckets[i].map((item) => {
                  if (item.__date) {
                    const span = item.end && item.end !== item.start ? `${short(item.start)} to ${short(item.end)}` : short(item.start);
                    return (
                      <span key={item.id} className={`holday kind-${item.kind}`} title={item.note || ''}>
                        {item.title}
                        <span style={{ opacity: 0.6 }}> · {span}</span>
                      </span>
                    );
                  }
                  const s = seriesById[item.series_id];
                  return (
                    <button key={item.id} className={`act act-${item.audience || 'joint'}`} onClick={() => open('activation', item.id)}>
                      <span className="act-title">{item.title}</span>
                      <span className="act-date">
                        {short(item.start_date)}
                        {item.end_date && item.end_date !== item.start_date ? ` to ${short(item.end_date)}` : ''}
                        {s ? ` · ${s.name}` : ''}
                      </span>
                      {item.pitch_room ? <span className="act-pitch">Pitch room open</span> : null}
                    </button>
                  );
                })}

                {on.typhoon && typhoonSeason && i >= 1 && i <= 3 ? (
                  <span className="holday" style={{ borderLeftColor: 'var(--amber)', background: 'rgba(154,107,18,0.06)' }}>
                    Typhoon season, keep a two week buffer on outdoor builds
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <div className="series-row">
          <span style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-40)', alignSelf: 'center' }}>
            Recurring series
          </span>
          {(series || []).map((s) => (
            <span key={s.id} className="series-pill">
              <span className="series-dot" style={{ background: s.colour || 'var(--tan)' }} />
              {s.name}
              <span style={{ color: 'var(--ink-40)' }}>{s.cadence}</span>
            </span>
          ))}
        </div>
      </div>

      {acts.length === 0 ? (
        <div className="empty" style={{ marginTop: 20 }}>
          <h3>No activations dated for {year} yet</h3>
          <p>
            The map fills as activations are entered. Each one can carry the projects that
            support it and a flag for where ADAM has room to pitch an idea.
          </p>
        </div>
      ) : null}

      <p className="foot-note">
        Holiday dates are the gazetted Hong Kong general holidays. School and festival
        run-up periods are working windows, not official closures, and can be edited.
        Typhoon behaviour cannot be dated in advance, so the layer states the working rules
        instead of guessing.
      </p>
    </>
  );
}

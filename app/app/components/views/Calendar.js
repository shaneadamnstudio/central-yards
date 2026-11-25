'use client';

import { useState, useMemo } from 'react';
import Masthead from '../Masthead';

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
const MONTHS = { 1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr', 5: 'May', 6: 'Jun', 7: 'Jul', 8: 'Aug', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dec' };

function qOf(dateStr) {
  return Math.floor(new Date(dateStr + 'T00:00:00').getMonth() / 3);
}
function short(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()} ${MONTHS[d.getMonth() + 1]}`;
}

const LAYERS = [
  { key: 'holiday', name: 'Public holidays' },
  { key: 'school', name: 'School holidays' },
  { key: 'cny', name: 'Lunar and festival' },
  { key: 'custom', name: 'Recurring dates' },
  { key: 'typhoon', name: 'Typhoon season' },
];

export default function Calendar({ data, open }) {
  const { activations, series, calendar } = data;
  const now = new Date();
  const years = [2026, 2027, 2028];
  const [year, setYear] = useState(years.includes(now.getFullYear() + 1) ? now.getFullYear() + 1 : 2027);
  const [on, setOn] = useState({ holiday: true, school: true, cny: true, custom: true, typhoon: false });

  const toggle = (k) => setOn((o) => ({ ...o, [k]: !o[k] }));

  const dates = useMemo(
    () => (calendar?.dates || []).filter((d) => new Date(d.start + 'T00:00:00').getFullYear() === year && on[d.kind]),
    [calendar, year, on]
  );

  const acts = useMemo(
    () => (activations || []).filter((a) => new Date(a.start_date + 'T00:00:00').getFullYear() === year),
    [activations, year]
  );

  const buckets = useMemo(() => {
    const q = [[], [], [], []];
    acts.forEach((a) => q[qOf(a.start_date)].push(a));
    dates.forEach((d) => q[qOf(d.start)].push({ __date: true, ...d }));
    q.forEach((list) => list.sort((x, y) => {
      const xs = x.__date ? x.start : x.start_date;
      const ys = y.__date ? y.start : y.start_date;
      return new Date(xs) - new Date(ys);
    }));
    return q;
  }, [acts, dates]);

  const seriesById = useMemo(() => {
    const m = {};
    (series || []).forEach((s) => { m[s.id] = s; });
    return m;
  }, [series]);

  return (
    <>
      <Masthead
        eyebrow={`Central Yards — ${year} Activation map`}
        title="Marketing moments and ADAM work on one calendar"
        lede={
          <>
            Central Yards activations and the ADAM projects supporting them, side by side.
            Each activation shows its dates, the projects behind it, and whether there is
            <b> room for ADAM to pitch</b>. Holiday and recurring layers sit underneath and
            toggle independently.
          </>
        }
        count={acts.length}
        countLabel={`Activations in ${year}`}
      />

      <div className="cal-wrap">
        <div className="cal-toolbar">
          <select className="cal-select" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          {LAYERS.map((l) => (
            <label key={l.key} className={'layer-toggle' + (on[l.key] ? ' on' : '')}>
              <input type="checkbox" checked={on[l.key]} onChange={() => toggle(l.key)} />
              {l.name}
            </label>
          ))}
          <span className="spacer" />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)' }}>
            {acts.length} activations, {dates.length} calendar entries
          </span>
        </div>

        <div className="quarters">
          {QUARTERS.map((q, i) => (
            <div key={q} className="qcol">
              <div className="qhead">{q} {year}</div>
              <div className="qbody">
                {buckets[i].length === 0 ? (
                  <div style={{ fontSize: 10, color: 'var(--faint)', padding: '6px 2px' }}>Nothing placed</div>
                ) : null}
                {buckets[i].map((item) => {
                  if (item.__date) {
                    const span = item.end && item.end !== item.start ? `${short(item.start)} to ${short(item.end)}` : short(item.start);
                    return (
                      <span key={item.id} className={`holday kind-${item.kind}`} title={item.note || ''}>
                        {item.title} · {span}
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
                {on.typhoon && i >= 1 && i <= 3 ? (
                  <span className="holday" style={{ borderLeftColor: 'var(--art)', background: 'rgba(111,74,19,.06)' }}>
                    Typhoon season, two week buffer on outdoor builds
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <div className="series-row">
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)' }}>
            Recurring series
          </span>
          {(series || []).map((s) => (
            <span key={s.id} className="series-pill">
              <span className="series-dot" style={{ background: s.colour || 'var(--tan)' }} />
              {s.name}
              <span style={{ color: 'var(--faint)' }}>{s.cadence}</span>
            </span>
          ))}
        </div>
      </div>

      <p className="foot-note">
        Holiday dates are the gazetted Hong Kong general holidays. School and festival
        run-up periods are working windows rather than official closures and can be edited.
        Typhoon behaviour cannot be dated in advance, so that layer states the working rules
        instead of guessing.
      </p>
    </>
  );
}

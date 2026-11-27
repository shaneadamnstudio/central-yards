'use client';

/* A real month calendar: a grid of day cells with the events drawn inside
   them, the way a calendar app works. Month is the primary view; year and
   quarters remain as secondary scans. */

import { useState, useMemo } from 'react';
import Masthead from '../Masthead';
import useReveal from '../useReveal';
import {
  MONTH_NAMES, WEEKDAYS, iso, parse, daysInMonth, weekdayMon,
  shortDate, todayISO, overlapsMonth,
} from './calDates';

const LAYERS = [
  { key: 'holiday', name: 'Public holidays' },
  { key: 'school', name: 'School holidays' },
  { key: 'cny', name: 'Lunar and festival' },
  { key: 'custom', name: 'Recurring dates' },
  { key: 'typhoon', name: 'Typhoon season' },
];

const VIEWS = [
  { key: 'month', name: 'Month' },
  { key: 'year', name: 'Year' },
  { key: 'quarters', name: 'By quarter' },
];

export default function Calendar({ data, open, placeActivation }) {
  const { activations, series, calendar } = data;
  const now = new Date();

  /* Offer every year the record covers, and always include next year so the
     team can plan ahead even before anything is dated. A year with no events
     still shows its holiday layer, so it is not a blank screen. */
  const years = useMemo(() => {
    const set = new Set();
    (calendar?.dates || []).forEach((d) => set.add(Number(String(d.start).slice(0, 4))));
    (activations || []).forEach((a) => set.add(Number(String(a.start_date).slice(0, 4))));
    set.add(now.getFullYear());
    set.add(now.getFullYear() + 1);
    set.add(2028);
    const list = Array.from(set).filter((y) => Number.isFinite(y)).sort();
    return list.length ? list : [now.getFullYear()];
  }, [calendar, activations, now]);

  const firstYear = years[0];
  const lastYear = years[years.length - 1];

  const [year, setYear] = useState(() => {
    const next = now.getFullYear() + 1;
    return years.includes(next) ? next : (years.includes(now.getFullYear()) ? now.getFullYear() : lastYear);
  });
  const [month, setMonth] = useState(now.getMonth());
  const [mode, setMode] = useState('month');
  const [on, setOn] = useState({ holiday: true, school: true, cny: true, custom: true, typhoon: false });
  const [dragging, setDragging] = useState(null);
  const [overDay, setOverDay] = useState(null);

  const toggle = (k) => setOn((o) => ({ ...o, [k]: !o[k] }));

  const seriesById = useMemo(() => {
    const m = {};
    (series || []).forEach((s) => { m[s.id] = s; });
    return m;
  }, [series]);

  const acts = useMemo(
    () => (activations || []).filter((a) => forYear(a.start_date, a.end_date, year)),
    [activations, year]
  );

  const dates = useMemo(
    () => (calendar?.dates || []).filter((d) => on[d.kind] && forYear(d.start, d.end, year)),
    [calendar, year, on]
  );

  const revealRef = useReveal([year, mode, month, on]);
  const today = todayISO();

  const monthHasNothing = useMemo(() => {
    const totalDays = daysInMonth(year, month);
    const hasDate = dates.some((d) => overlapsMonth(d.start, d.end, year, month));
    const hasAct = acts.some((a) => overlapsMonth(a.start_date, a.end_date, year, month));
    return totalDays > 0 && !hasDate && !hasAct;
  }, [acts, dates, year, month]);

  function shiftMonth(delta) {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    /* hold at the edge of the data rather than stepping into an empty year */
    if (!years.includes(y)) return;
    setYear(y);
    setMonth(m);
  }

  const atFirst = year === firstYear && month === 0;
  const atLast = year === lastYear && month === 11;

  function onDrop(dayKey) {
    if (!dragging) return;
    const a = acts.find((x) => x.id === dragging);
    if (!a) return;

    let newEnd = null;
    if (a.end_date && a.end_date !== a.start_date) {
      const span = Math.round((parse(a.end_date) - parse(a.start_date)) / 86400000);
      const t = parse(dayKey);
      t.setDate(t.getDate() + span);
      newEnd = iso(t.getFullYear(), t.getMonth(), t.getDate());
    }
    placeActivation(dragging, dayKey, newEnd);
    setDragging(null);
    setOverDay(null);
  }

  return (
    <>
      <Masthead
        eyebrow={`Central Yards — ${year} activation map`}
        title="Activations, day by day"
        lede={
          <>
            Central Yards activations and the ADAM work behind them, laid out like a calendar
            with each event on the day it happens. Holidays, school breaks and recurring dates
            sit underneath.
          </>
        }
        count={acts.length}
        countLabel={`Activations in ${year}`}
      />

      <div className="cal-wrap">
        <div className="cal-toolbar">
          <div className="cal-nav">
            <button className="btn btn-sm" onClick={() => shiftMonth(-1)} aria-label="Previous month" disabled={atFirst}>&larr;</button>
            <span className="cal-title">{MONTH_NAMES[month]} {year}</span>
            <button className="btn btn-sm" onClick={() => shiftMonth(1)} aria-label="Next month" disabled={atLast}>&rarr;</button>
            <button
              className="btn btn-sm"
              onClick={() => {
                setMonth(now.getMonth());
                setYear(years.includes(now.getFullYear()) ? now.getFullYear() : 2027);
              }}
            >
              Today
            </button>
          </div>

          <div className="tabs" style={{ margin: 0 }}>
            {VIEWS.map((v) => (
              <button key={v.key} className={'tab' + (mode === v.key ? ' on' : '')} onClick={() => setMode(v.key)}>
                {v.name}
              </button>
            ))}
          </div>

          <span className="spacer" />

          {years.length > 1 ? (
            <select className="cal-select" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          ) : null}
        </div>

        <div className="cal-layers">
          {LAYERS.map((l) => (
            <label key={l.key} className={'layer-toggle' + (on[l.key] ? ' on' : '')}>
              <input type="checkbox" checked={on[l.key]} onChange={() => toggle(l.key)} />
              <span className={'layer-swatch sw-' + l.key} />
              {l.name}
            </label>
          ))}
        </div>

        <div ref={revealRef}>
          {mode === 'month' && monthHasNothing ? (
            <div className="note-strip" style={{ marginBottom: 12 }}>
              Nothing is scheduled in {MONTH_NAMES[month]} {year}. Hong Kong has no public
              holidays this month, and no activations are dated here yet.
            </div>
          ) : null}

          {mode === 'month' ? (
            <MonthView
              year={year}
              month={month}
              acts={acts}
              dates={dates}
              seriesById={seriesById}
              open={open}
              today={today}
              dragging={dragging}
              overDay={overDay}
              setDragging={setDragging}
              setOverDay={setOverDay}
              onDrop={onDrop}
            />
          ) : null}

          {mode === 'year' ? (
            <YearView
              year={year}
              acts={acts}
              open={open}
              today={today}
              onPickMonth={(m) => { setMonth(m); setMode('month'); }}
            />
          ) : null}

          {mode === 'quarters' ? (
            <QuarterView year={year} acts={acts} dates={dates} seriesById={seriesById} open={open} onTyphoon={on.typhoon} />
          ) : null}
        </div>
      </div>

      <p className="foot-note">
        Holiday dates are the gazetted Hong Kong general holidays. School and festival run-up
        periods are working windows rather than official closures and can be edited. Drag an
        activation onto a day to move it.
      </p>
    </>
  );
}

function forYear(start, end, year) {
  const a = String(start).slice(0, 4);
  const b = String(end || start).slice(0, 4);
  return Number(a) <= year && Number(b) >= year;
}

/* how many event lanes this cell must reserve, so tallies line up */
function laneCount(info, actLanes) {
  if (!info.acts.length) return 0;
  return Math.max(...info.acts.map((a) => (actLanes[a.id] ?? 0))) + 1;
}

/* ---------- the month: a real calendar ----------
   Every day is a cell tall enough to hold its events, and each event is drawn
   inside the cell on the day it happens. Leading and trailing days from the
   adjacent months are shown greyed so the grid is always whole weeks. */
function MonthView({ year, month, acts, dates, seriesById, open, today, dragging, overDay, setDragging, setOverDay, onDrop }) {
  const totalDays = daysInMonth(year, month);
  const offset = weekdayMon(year, month, 1);

  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const prevDays = daysInMonth(prevYear, prevMonth);

  const cells = useMemo(() => {
    const out = [];
    for (let i = offset; i > 0; i -= 1) {
      const d = prevDays - i + 1;
      out.push({ day: d, key: iso(prevYear, prevMonth, d), outside: true });
    }
    for (let d = 1; d <= totalDays; d += 1) {
      out.push({ day: d, key: iso(year, month, d), outside: false });
    }
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    let fill = 1;
    while (out.length % 7 !== 0) {
      out.push({ day: fill, key: iso(nextYear, nextMonth, fill), outside: true });
      fill += 1;
    }
    return out;
  }, [offset, totalDays, year, month, prevDays, prevMonth, prevYear]);

  /* Events must hold a stable vertical lane. If a cell simply stacks whatever
     falls on that day, a long bar drops a row whenever a holiday shares the
     date and the span reads as separate chips instead of one bar. So every
     activation is given a fixed lane index, and each cell renders that lane
     whether or not the event starts there. */
  const { byDay, actLanes } = useMemo(() => {
    const map = {};
    for (let d = 1; d <= totalDays; d += 1) map[d] = { acts: [], dates: [] };

    const visible = acts.filter((a) => overlapsMonth(a.start_date, a.end_date, year, month));

    /* lane = index in a stable order, so the same event keeps its row all month */
    const lanes = {};
    visible
      .slice()
      .sort((a, b) => {
        const as = parse(a.start_date);
        const bs = parse(b.start_date);
        if (as - bs !== 0) return as - bs;
        return String(a.title).localeCompare(String(b.title));
      })
      .forEach((a, i) => { lanes[a.id] = i; });

    visible.forEach((a) => {
      const s = parse(a.start_date);
      const e = parse(a.end_date || a.start_date);
      const first = s.getFullYear() === year && s.getMonth() === month ? s.getDate() : 1;
      const last = e.getFullYear() === year && e.getMonth() === month ? e.getDate() : totalDays;
      for (let d = first; d <= Math.min(last, totalDays); d += 1) {
        if (map[d]) map[d].acts.push(a);
      }
    });

    dates.forEach((x) => {
      if (!overlapsMonth(x.start, x.end, year, month)) return;
      const s = parse(x.start);
      const e = parse(x.end || x.start);
      const first = s.getFullYear() === year && s.getMonth() === month ? s.getDate() : 1;
      const last = e.getFullYear() === year && e.getMonth() === month ? e.getDate() : totalDays;
      for (let d = first; d <= Math.min(last, totalDays); d += 1) {
        if (map[d]) map[d].dates.push(x);
      }
    });
    return { byDay: map, actLanes: lanes };
  }, [acts, dates, year, month, totalDays]);

  return (
    <div className="monthview">
      <div className="mv-weekdays">
        {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
      </div>
      <div className="mv-grid">
        {cells.map((c) => {
          const info = c.outside ? { acts: [], dates: [] } : (byDay[c.day] || { acts: [], dates: [] });
          const isToday = c.key === today;
          const isOver = overDay === c.key;
          return (
            <div
              key={c.key}
              className={
                'mv-cell' +
                (c.outside ? ' mv-outside' : '') +
                (isToday ? ' mv-today' : '') +
                (isOver ? ' mv-over' : '')
              }
              onDragOver={(e) => { if (!c.outside) { e.preventDefault(); setOverDay(c.key); } }}
              onDragLeave={() => setOverDay((k) => (k === c.key ? null : k))}
              onDrop={(e) => { if (!c.outside) { e.preventDefault(); onDrop(c.key); } }}
            >
              <div className="mv-daynum">{c.day}</div>

              <div className={'mv-dates-strip' + (info.dates.length ? '' : ' mv-strip-empty')}>
                {info.dates.map((x) => {
                  /* a span shows its name on the first day it covers and a bare
                     bar after that, so a fortnight break is one thing on the
                     calendar rather than the same words twenty times */
                  const startKey = String(x.start).slice(0, 10);
                  const endKey = String(x.end || x.start).slice(0, 10);
                  const isFirst = startKey === c.key
                    || (c.day === 1 && startKey < c.key)
                    /* label the first day of a week too: a fortnight span that
                       went blank after its first cell read as empty space */
                    || (info.dates.length && weekdayMon(year, month, c.day) === 0);
                  return (
                    <span
                      key={x.id}
                      className={
                        'mv-date mv-date-' + x.kind +
                        (x.end && x.end !== x.start && !isFirst ? ' mv-date-cont' : '')
                      }
                      title={x.note || x.title}
                    >
                      {isFirst ? x.title : '\u00a0'}
                    </span>
                  );
                })}
              </div>

              <div className="mv-items">

                {/* One fixed-height slot per lane, in lane order, empty ones
                    included. Without the empty slots a holiday above the bar
                    shortens the column and the bar steps down on that day. */}
                {Array.from({ length: laneCount(info, actLanes) }, (_, lane) => {
                  const a = info.acts.find((x) => (actLanes[x.id] ?? 0) === lane);
                  if (!a) return <span key={'lane' + lane} className="mv-lane" />;

                  const startKey = String(a.start_date).slice(0, 10);
                  const endKey = String(a.end_date || a.start_date).slice(0, 10);
                  const isStart = startKey === c.key;
                  const isEnd = endKey === c.key;
                  const multi = a.end_date && a.end_date !== a.start_date;

                  return (
                    <button
                      key={a.id}
                      className={
                        'mv-act' +
                        (a.audience === 'adam' ? ' mv-act-adam' : a.audience === 'central_yards' ? ' mv-act-cy' : ' mv-act-joint') +
                        (multi && isStart ? ' mv-start' : '') +
                        (multi && !isStart ? ' mv-cont' : '') +
                        (multi && isEnd ? ' mv-end' : '') +
                        (dragging === a.id ? ' dragging' : '')
                      }
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', a.id);
                        e.dataTransfer.effectAllowed = 'move';
                        setDragging(a.id);
                      }}
                      onDragEnd={() => { setDragging(null); setOverDay(null); }}
                      onClick={() => open('activation', a.id)}
                      title={`${a.title} · ${shortDate(a.start_date)}${multi ? ' to ' + shortDate(a.end_date) : ''}${a.pitch_room ? ' · pitch room open' : ''}`}
                    >
                      {isStart ? a.title : '\u00a0'}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- year: twelve mini months, a quick scan ---------- */
function YearView({ year, acts, open, today, onPickMonth }) {
  return (
    <div className="yeargrid">
      {Array.from({ length: 12 }, (_, m) => {
        const inMonth = acts.filter((a) => overlapsMonth(a.start_date, a.end_date, year, m));
        const totalDays = daysInMonth(year, m);
        const offset = weekdayMon(year, m, 1);
        return (
          <div key={m} className="month reveal">
            <div className="month-head">
              <button className="month-name month-name-btn" onClick={() => onPickMonth(m)} title="Open this month">
                {MONTH_NAMES[m]}
              </button>
              <span className="month-meta">{inMonth.length || ''}</span>
            </div>
            <div className="month-weekdays">
              {WEEKDAYS.map((w) => <span key={w}>{w.slice(0, 1)}</span>)}
            </div>
            <div className="month-grid">
              {Array.from({ length: offset }, (_, i) => <span key={'p' + i} className="day pad" />)}
              {Array.from({ length: totalDays }, (_, i) => {
                const day = i + 1;
                const key = iso(year, m, day);
                const hasAct = inMonth.some((a) => {
                  const s = parse(a.start_date);
                  const e = parse(a.end_date || a.start_date);
                  const first = s.getFullYear() === year && s.getMonth() === m ? s.getDate() : 1;
                  const last = e.getFullYear() === year && e.getMonth() === m ? e.getDate() : daysInMonth(year, m);
                  return day >= first && day <= last;
                });
                return (
                  <span key={key} className={'day' + (hasAct ? ' marked' : '') + (key === today ? ' today' : '')}>
                    {day}
                  </span>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- quarters ---------- */
function QuarterView({ year, acts, dates, seriesById, open, onTyphoon }) {
  const buckets = useMemo(() => {
    const q = [[], [], [], []];
    acts.forEach((a) => q[Math.floor(parse(a.start_date).getMonth() / 3)].push(a));
    dates.forEach((d) => q[Math.floor(parse(d.start).getMonth() / 3)].push({ __date: true, ...d }));
    q.forEach((list) => list.sort((x, y) => parse(x.__date ? x.start : x.start_date) - parse(y.__date ? y.start : y.start_date)));
    return q;
  }, [acts, dates]);

  return (
    <div className="quarters">
      {['Q1', 'Q2', 'Q3', 'Q4'].map((q, i) => (
        <div key={q} className="qcol">
          <div className="qhead">{q} {year}</div>
          <div className="qbody">
            {buckets[i].length === 0 ? <div style={{ fontSize: 10, color: 'var(--faint)', padding: '6px 2px' }}>Nothing placed</div> : null}
            {buckets[i].map((item) => {
              if (item.__date) {
                const span = item.end && item.end !== item.start ? `${shortDate(item.start)} to ${shortDate(item.end)}` : shortDate(item.start);
                return <span key={item.id} className={`holday kind-${item.kind}`}>{item.title} · {span}</span>;
              }
              const s = seriesById[item.series_id];
              return (
                <button key={item.id} className={`act act-${item.audience || 'joint'}`} onClick={() => open('activation', item.id)}>
                  <span className="act-title">{item.title}</span>
                  <span className="act-date">
                    {shortDate(item.start_date)}
                    {item.end_date && item.end_date !== item.start_date ? ` to ${shortDate(item.end_date)}` : ''}
                    {s ? ` · ${s.name}` : ''}
                  </span>
                  {item.pitch_room ? <span className="act-pitch">Pitch room open</span> : null}
                </button>
              );
            })}
            {onTyphoon && i >= 1 && i <= 3 ? (
              <span className="holday" style={{ borderLeftColor: 'var(--art)', background: 'rgba(111,74,19,.06)' }}>Typhoon season</span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

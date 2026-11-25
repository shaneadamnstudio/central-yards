'use client';

import { useState, useMemo } from 'react';
import Masthead from '../Masthead';
import useReveal from '../useReveal';
import {
  MONTH_NAMES, MONTH_SHORT, WEEKDAYS, iso, parse, daysInMonth, weekdayMon,
  shortDate, todayISO, overlapsMonth, daysInMonthFor,
} from './calDates';

const LAYERS = [
  { key: 'holiday', name: 'Public holidays' },
  { key: 'school', name: 'School holidays' },
  { key: 'cny', name: 'Lunar and festival' },
  { key: 'custom', name: 'Recurring dates' },
  { key: 'typhoon', name: 'Typhoon season' },
];

const VIEWS = [
  { key: 'calendar', name: 'Calendar' },
  { key: 'quarters', name: 'By quarter' },
];

function qOf(start) {
  return Math.floor(parse(start).getMonth() / 3);
}

export default function Calendar({ data, open }) {
  const { activations, series, calendar } = data;
  const now = new Date();
  const years = [2026, 2027, 2028];
  const [year, setYear] = useState(years.includes(now.getFullYear() + 1) ? now.getFullYear() + 1 : 2027);
  const [mode, setMode] = useState('calendar');
  const [on, setOn] = useState({ holiday: true, school: true, cny: true, custom: true, typhoon: false });

  const toggle = (k) => setOn((o) => ({ ...o, [k]: !o[k] }));

  const seriesById = useMemo(() => {
    const m = {};
    (series || []).forEach((s) => { m[s.id] = s; });
    return m;
  }, [series]);

  /* everything that belongs on the grid this year */
  const acts = useMemo(
    () => (activations || []).filter((a) => forYear(a.start_date, a.end_date, year)),
    [activations, year]
  );

  const dates = useMemo(
    () => (calendar?.dates || []).filter((d) => on[d.kind] && forYear(d.start, d.end, year)),
    [calendar, year, on]
  );

  const revealRef = useReveal([year, mode, on]);

  const today = todayISO();

  return (
    <>
      <Masthead
        eyebrow={`Central Yards — ${year} Activation map`}
        title="Marketing moments and ADAM work on one calendar"
        lede={
          <>
            Central Yards activations and the ADAM projects supporting them, month by month.
            Each activation shows its dates, the projects behind it, and whether there is
            <b> room for ADAM to pitch</b>. Holidays, school breaks and recurring dates sit
            underneath and toggle independently.
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

          <div className="tabs" style={{ margin: 0 }}>
            {VIEWS.map((v) => (
              <button key={v.key} className={'tab' + (mode === v.key ? ' on' : '')} onClick={() => setMode(v.key)}>
                {v.name}
              </button>
            ))}
          </div>

          <span className="spacer" />

          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)' }}>
            {acts.length} activations, {dates.length} calendar entries
          </span>
        </div>

        <div className="cal-toolbar" style={{ borderBottom: 0, paddingBottom: 4, marginBottom: 10 }}>
          {LAYERS.map((l) => (
            <label key={l.key} className={'layer-toggle' + (on[l.key] ? ' on' : '')}>
              <input type="checkbox" checked={on[l.key]} onChange={() => toggle(l.key)} />
              {l.name}
            </label>
          ))}
        </div>

        <div ref={revealRef}>
          {mode === 'calendar'
            ? <YearGrid year={year} acts={acts} dates={dates} seriesById={seriesById} open={open} today={today} typhoon={calendar?.typhoon} onTyphoon={on.typhoon} />
            : <QuarterView year={year} acts={acts} dates={dates} seriesById={seriesById} open={open} onTyphoon={on.typhoon} />}
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

/* an item belongs to the year if any part of it falls inside */
function forYear(start, end, year) {
  const a = String(start).slice(0, 4);
  const b = String(end || start).slice(0, 4);
  return Number(a) <= year && Number(b) >= year;
}

/* ---------- the calendar: twelve months, Monday first ---------- */
function YearGrid({ year, acts, dates, seriesById, open, today, typhoon, onTyphoon }) {
  const months = Array.from({ length: 12 }, (_, m) => m);

  return (
    <div className="yeargrid">
      {months.map((m) => {
        const inMonth = acts.filter((a) => overlapsMonth(a.start_date, a.end_date, year, m));
        const dInMonth = dates.filter((d) => overlapsMonth(d.start, d.end, year, m));
        const totalDays = daysInMonth(year, m);
        const offset = weekdayMon(year, m, 1);

        /* per-day markers, so a holiday shows on its own square */
        const byDay = {};
        dInMonth.forEach((d) => {
          const a = parse(d.start);
          const b = parse(d.end || d.start);
          const first = a.getFullYear() === year && a.getMonth() === m ? a.getDate() : 1;
          const last = b.getFullYear() === year && b.getMonth() === m ? b.getDate() : totalDays;
          for (let day = first; day <= Math.min(last, totalDays); day += 1) {
            (byDay[day] = byDay[day] || []).push(d);
          }
        });

        const typhoonHere = onTyphoon && typhoon?.season && m + 1 >= typhoon.season.start_month && m + 1 <= typhoon.season.end_month;

        return (
          <div key={m} className="month reveal">
            <div className="month-head">
              <span className="month-name">{MONTH_NAMES[m]}</span>
              <span className="month-meta">
                {inMonth.length ? `${inMonth.length} activation${inMonth.length === 1 ? '' : 's'}` : ''}
              </span>
            </div>

            <div className="month-weekdays">
              {WEEKDAYS.map((w) => <span key={w}>{w.slice(0, 1)}</span>)}
            </div>

            <div className="month-grid">
              {Array.from({ length: offset }, (_, i) => <span key={'pad' + i} className="day pad" />)}
              {Array.from({ length: totalDays }, (_, i) => {
                const day = i + 1;
                const key = iso(year, m, day);
                const marks = byDay[day] || [];
                const isToday = key === today;
                const kinds = new Set(marks.map((x) => x.kind));
                return (
                  <span
                    key={key}
                    className={
                      'day' +
                      (marks.length ? ' marked' : '') +
                      (kinds.has('holiday') ? ' h-holiday' : kinds.has('school') ? ' h-school' : kinds.has('cny') ? ' h-cny' : '') +
                      (isToday ? ' today' : '')
                    }
                    title={marks.map((x) => x.title).join(', ')}
                  >
                    {day}
                  </span>
                );
              })}
            </div>

            {inMonth.length ? (
              <div className="month-items">
                {inMonth.map((a) => {
                  const s = seriesById[a.series_id];
                  const days = daysInMonthFor(a.start_date, a.end_date, year, m);
                  const full = daysInMonthFor(a.start_date, a.end_date, year, m) === daysInMonthFor(a.start_date, a.end_date, year, m);
                  return (
                    <button key={a.id} className={`act act-${a.audience || 'joint'}`} onClick={() => open('activation', a.id)}>
                      <span className="act-title">{a.title}</span>
                      <span className="act-date">
                        {shortDate(a.start_date)}
                        {a.end_date && a.end_date !== a.start_date ? ` to ${shortDate(a.end_date)}` : ''}
                        {s ? ` · ${s.name}` : ''}
                      </span>
                      {a.pitch_room ? <span className="act-pitch">Pitch room open</span> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {typhoonHere ? (
              <span className="holday" style={{ borderLeftColor: 'var(--art)', background: 'rgba(111,74,19,.06)', marginTop: 6 }}>
                Typhoon season
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- the quarter view, kept as the secondary read ---------- */
function QuarterView({ year, acts, dates, seriesById, open, onTyphoon }) {
  const buckets = useMemo(() => {
    const q = [[], [], [], []];
    acts.forEach((a) => q[qOf(a.start_date)].push(a));
    dates.forEach((d) => q[qOf(d.start)].push({ __date: true, ...d }));
    q.forEach((list) => list.sort((x, y) => {
      const xs = x.__date ? x.start : x.start_date;
      const ys = y.__date ? y.start : y.start_date;
      return parse(xs) - parse(ys);
    }));
    return q;
  }, [acts, dates]);

  return (
    <div className="quarters">
      {['Q1', 'Q2', 'Q3', 'Q4'].map((q, i) => (
        <div key={q} className="qcol">
          <div className="qhead">{q} {year}</div>
          <div className="qbody">
            {buckets[i].length === 0 ? (
              <div style={{ fontSize: 10, color: 'var(--faint)', padding: '6px 2px' }}>Nothing placed</div>
            ) : null}
            {buckets[i].map((item) => {
              if (item.__date) {
                const span = item.end && item.end !== item.start
                  ? `${shortDate(item.start)} to ${shortDate(item.end)}`
                  : shortDate(item.start);
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
                    {shortDate(item.start_date)}
                    {item.end_date && item.end_date !== item.start_date ? ` to ${shortDate(item.end_date)}` : ''}
                    {s ? ` · ${s.name}` : ''}
                  </span>
                  {item.pitch_room ? <span className="act-pitch">Pitch room open</span> : null}
                </button>
              );
            })}
            {onTyphoon && i >= 1 && i <= 3 ? (
              <span className="holday" style={{ borderLeftColor: 'var(--art)', background: 'rgba(111,74,19,.06)' }}>
                Typhoon season, two week buffer on outdoor builds
              </span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Home from './views/Home';
import Projects from './views/Projects';
import Calendar from './views/Calendar';
import Tasks from './views/Tasks';
import Partnerships from './views/Partnerships';
import Social from './views/Social';
import Finance from './views/Finance';
import Decks from './views/Decks';
import Drawer from './views/Drawer';
import useWrite from './useWrite';

const VIEWS = [
  { key: 'home', name: 'Overview' },
  { key: 'calendar', name: 'Activation map' },
  { key: 'projects', name: 'Projects' },
  { key: 'tasks', name: 'To-do' },
  { key: 'partnerships', name: 'Partnerships' },
  { key: 'social', name: 'Social' },
  { key: 'finance', name: 'Finance' },
  { key: 'decks', name: 'Decks' },
];

const EMPTY = {
  config: null,
  calendar: null,
  projects: [],
  project_links: [],
  tasks: [],
  activations: [],
  activation_support: [],
  series: [],
  ideas: [],
  social_ideas: [],
  quotes: [],
  decks: [],
};

export default function Workspace({ scope }) {
  const isAdam = scope === 'adam';
  const [view, setView] = useState('home');
  const [data, setData] = useState(EMPTY);
  const [phase, setPhase] = useState('loading');
  const [sel, setSel] = useState(null);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [clock, setClock] = useState('');

  /* clock. Central Yards is in Hong Kong, so it reads Hong Kong time only. */
  useEffect(() => {
    function tick() {
      try {
        const t = new Intl.DateTimeFormat('en-GB', {
          hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Hong_Kong', hour12: false,
        }).format(new Date());
        setClock(`HKG ${t}`);
      } catch (e) {
        setClock('');
      }
    }
    tick();
    const timer = setInterval(tick, 30000);
    return () => clearInterval(timer);
  }, []);

  /* the wordmark path is injected into <symbol id="adam"> by public/wordmark-path.js */
  useEffect(() => {
    if (document.getElementById('wordmark-loader')) return;
    const s = document.createElement('script');
    s.id = 'wordmark-loader';
    s.src = '/wordmark-path.js';
    s.defer = true;
    document.body.appendChild(s);
  }, []);

  useEffect(() => {
    let dead = false;
    async function load() {
      try {
        const [cfg, cal, seed, saved] = await Promise.all([
          fetch('/config.json').then((r) => r.json()),
          fetch('/hk-calendar.json').then((r) => r.json()),
          fetch('/api/workspace', { cache: 'no-store' }).then(async (r) => {
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || `workspace ${r.status}`);
            return d;
          }),
          fetch('/api/state', { cache: 'no-store' }).then(async (r) => {
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || `state ${r.status}`);
            return d;
          }),
        ]);
        if (dead) return;

        /* The database owns status and dates. The seed deliberately carries
           neither, so a value cannot exist in two places and win the merge. */
        const taskState = saved.tasks || {};
        const placements = saved.placements || {};

        setData({
          ...EMPTY,
          config: cfg,
          calendar: cal,
          projects: seed.projects || [],
          project_links: seed.project_links || [],
          tasks: (seed.tasks || []).map((t) => ({
            ...t,
            status: taskState[t.id] || 'open',
          })),
          activations: (seed.activations || []).map((a) => {
            const p = placements[a.id];
            return p
              ? { ...a, start_date: p.start_date, end_date: p.end_date || null }
              : a;
          }),
          activation_support: seed.activation_support || [],
          series: seed.series || [],
          ideas: seed.ideas || [],
          social_ideas: seed.social_ideas || [],
          quotes: seed.quotes || [],
          decks: seed.decks || [],
        });
        setSaveError('');
        setPhase('ready');
      } catch (e) {
        if (dead) return;
        setError('Could not load the workspace. ' + (e?.message || 'Unknown error.'));
        setPhase('error');
      }
    }
    load();
    return () => { dead = true; };
  }, []);

  /* scope filter: internal items never reach a CY browser */
  const visible = useMemo(() => {
    if (isAdam) return data;
    const keep = (rows) => (rows || []).filter((r) => r.visibility !== 'internal');
    return {
      ...data,
      projects: keep(data.projects),
      project_links: keep(data.project_links),
      tasks: keep(data.tasks),
      activations: keep(data.activations),
      ideas: keep(data.ideas),
      social_ideas: (data.social_ideas || []).filter((s) => s.status === 'shared' || s.status === 'ready'),
      quotes: (data.quotes || []).filter((q) => q.status === 'confirmed' && q.visibility !== 'internal'),
      decks: keep(data.decks),
    };
  }, [data, isAdam]);

  const counts = useMemo(() => ({
    projects: visible.projects.length,
    tasks: visible.tasks.filter((t) => t.status !== 'done').length,
    activations: visible.activations.length,
    partnerships: visible.ideas.length,
    finance: visible.quotes.length,
    decks: visible.decks.length,
  }), [visible]);

  const { write } = useWrite(setSaveError);

  /* move an activation to a day. state is the only source of truth for dates. */
  const placeActivation = useCallback(async (id, startDate, endDate) => {
    setData((d) => ({
      ...d,
      activations: d.activations.map((a) => (a.id === id ? { ...a, start_date: startDate, end_date: endDate || a.end_date } : a)),
    }));
    await write({ placements: { [id]: { start_date: startDate, end_date: endDate || null } } }, 'place:' + id);
  }, [write]);

  /* tick a task done, or reopen it */
  const setTaskStatus = useCallback(async (id, status) => {
    setData((d) => ({
      ...d,
      tasks: d.tasks.map((t) => (t.id === id ? { ...t, status } : t)),
    }));
    await write({ tasks: { [id]: status } }, 'task:' + id);
  }, [write]);

  const open = useCallback((type, id) => setSel({ type, id }), []);
  const close = useCallback(() => setSel(null), []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setSel(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (phase === 'loading') return <div className="boot">Loading workspace</div>;
  if (phase === 'error') {
    const notConfigured = /not configured/i.test(error);
    return (
      <div className="boot boot-err">
        <div className="boot-card">
          <p className="boot-mark">Central Yards</p>
          <h1>Workspace unavailable</h1>
          <p className="boot-msg">{error}</p>

          {notConfigured ? (
            <div className="boot-help">
              <p className="boot-step-title">What to do</p>
              <p className="boot-lead">
                This site is live but not yet connected to its database. Whoever set up the
                Vercel project needs to add three things, then redeploy. Takes about five minutes.
              </p>

              <div className="boot-item">
                <span className="boot-num">1</span>
                <div>
                  <p className="boot-item-title">Open the project in Vercel</p>
                  <p className="boot-item-body">Settings &rarr; Environment Variables.</p>
                </div>
              </div>

              <div className="boot-item">
                <span className="boot-num">2</span>
                <div>
                  <p className="boot-item-title">Add the database address</p>
                  <p className="boot-item-body">Name <code className="kv">NEXT_PUBLIC_SUPABASE_URL</code></p>
                  <p className="boot-item-body">Value <code className="kv">https://khwbtduvdfrlozsupvls.supabase.co</code></p>
                </div>
              </div>

              <div className="boot-item">
                <span className="boot-num">3</span>
                <div>
                  <p className="boot-item-title">Add the database key</p>
                  <p className="boot-item-body">Name <code className="kv">SUPABASE_SERVICE_ROLE_KEY</code></p>
                  <p className="boot-item-body">
                    Value is the service role key from the Supabase project (Settings &rarr; API).
                    Server-side only: never prefix it with NEXT_PUBLIC_.
                  </p>
                </div>
              </div>

              <div className="boot-item">
                <span className="boot-num">4</span>
                <div>
                  <p className="boot-item-title">Add the access codes</p>
                  <p className="boot-item-body">
                    <code className="kv">GATE_SECRET</code>, any long random string;
                    <code className="kv">GATE_DAYS</code>, set to <code className="kv">30</code>;
                    and <code className="kv">GATE_CODES</code>, the two team codes.
                  </p>
                </div>
              </div>

              <div className="boot-item">
                <span className="boot-num">5</span>
                <div>
                  <p className="boot-item-title">Redeploy</p>
                  <p className="boot-item-body">
                    Deployments &rarr; the latest one &rarr; Redeploy. Environment variables
                    only take effect on a new build, so the existing deploy will keep failing
                    until this is done.
                  </p>
                </div>
              </div>

              <p className="boot-note">
                There is deliberately no sample data behind this screen. A fallback that looks
                like live content is worse than an error, because every edit appears to save and
                none of them persist.
              </p>
            </div>
          ) : null}

          <button className="btn" onClick={() => window.location.reload()}>Try again</button>
        </div>
      </div>
    );
  }

  const ctx = { data: visible, full: data, isAdam, counts, open, config: data.config, placeActivation, setTaskStatus, saveError, setSaveError };

  return (
    <>
      <header className="chrome">
        <nav className="topnav" role="tablist" aria-label="Sections">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              className="tn-head"
              role="tab"
              aria-selected={view === v.key ? 'true' : 'false'}
              onClick={() => setView(v.key)}
            >
              {v.name}
              {v.key === 'projects' && counts.projects ? <em>{counts.projects}</em> : null}
              {v.key === 'tasks' && counts.tasks ? <em>{counts.tasks}</em> : null}
              {v.key === 'calendar' && counts.activations ? <em>{counts.activations}</em> : null}
            </button>
          ))}
        </nav>
        <div className="chrome-right">
          {saveError ? (
            <span className="save-err" role="alert" onClick={() => setSaveError('')}>
              {saveError}
            </span>
          ) : null}
          <span className="clock">{clock}</span>
          <span>{isAdam ? 'ADAM' : 'Central Yards'}</span>
          <a className="signout" href="/auth/signout">Sign out</a>
        </div>
      </header>

      <main className="main">
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
          <symbol id="adam" viewBox="0 0 2228 674" />
        </svg>

        {view === 'home' && <Home {...ctx} />}
        {view === 'calendar' && <Calendar {...ctx} />}
        {view === 'projects' && <Projects {...ctx} />}
        {view === 'tasks' && <Tasks {...ctx} />}
        {view === 'partnerships' && <Partnerships {...ctx} />}
        {view === 'social' && <Social {...ctx} />}
        {view === 'finance' && <Finance {...ctx} />}
        {view === 'decks' && <Decks {...ctx} />}
      </main>

      {sel ? <Drawer sel={sel} ctx={ctx} onClose={close} /> : null}
    </>
  );
}

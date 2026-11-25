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
  const [clock, setClock] = useState('');

  /* dual clock, carried from the Supply Co. chrome */
  useEffect(() => {
    function tick() {
      const f = (tz) => {
        try {
          return new Intl.DateTimeFormat('en-GB', {
            hour: '2-digit', minute: '2-digit', timeZone: tz, hour12: false,
          }).format(new Date());
        } catch (e) { return '--:--'; }
      };
      setClock(`HKG ${f('Asia/Hong_Kong')}  ·  SFO ${f('America/Los_Angeles')}`);
    }
    tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
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
        const [cfg, cal, seed] = await Promise.all([
          fetch('/config.json').then((r) => r.json()),
          fetch('/hk-calendar.json').then((r) => r.json()),
          fetch('/seed.json').then((r) => r.json()),
        ]);
        if (dead) return;
        setData({
          ...EMPTY,
          config: cfg,
          calendar: cal,
          projects: seed.projects || [],
          project_links: seed.project_links || [],
          tasks: seed.tasks || [],
          activations: seed.activations || [],
          activation_support: seed.activation_support || [],
          series: seed.series || [],
          ideas: seed.ideas || [],
          social_ideas: seed.social_ideas || [],
          quotes: seed.quotes || [],
          decks: seed.decks || [],
        });
        setPhase('ready');
      } catch (e) {
        if (dead) return;
        setError('Could not load the workspace data. ' + (e?.message || ''));
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

  const open = useCallback((type, id) => setSel({ type, id }), []);
  const close = useCallback(() => setSel(null), []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setSel(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (phase === 'loading') return <div className="boot">Loading workspace</div>;
  if (phase === 'error') return <div className="boot boot-err">{error}</div>;

  const ctx = { data: visible, full: data, isAdam, counts, open, config: data.config };

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

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
  { key: 'partnerships', name: 'Partnerships & Ideas' },
  { key: 'social', name: 'Social' },
  { key: 'finance', name: 'Finance' },
  { key: 'decks', name: 'Decks & Pitches' },
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
  const [sel, setSel] = useState(null); // { type, id }
  const [error, setError] = useState('');

  /* ---------- load ---------- */
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

  /* ---------- scope filter: internal items never reach a CY browser ---------- */
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
      // social: ADAM keeps everything; CY only receives what ADAM marked ready or shared
      social_ideas: (data.social_ideas || []).filter((s) => s.status === 'shared' || s.status === 'ready'),
      // quotes are internal until confirmed; the CY view sees confirmed only
      quotes: (data.quotes || []).filter((q) => q.status === 'confirmed' && q.visibility !== 'internal'),
      decks: keep(data.decks),
    };
  }, [data, isAdam]);

  const counts = useMemo(() => ({
    projects: visible.projects.length,
    tasks: visible.tasks.filter((t) => t.status !== 'done').length,
    activations: visible.activations.length,
    ideas: visible.ideas.length + visible.social_ideas.length,
    finance: visible.quotes.filter((q) => q.status !== 'confirmed').length,
    decks: visible.decks.length,
  }), [visible]);

  const open = useCallback((type, id) => setSel({ type, id }), []);
  const close = useCallback(() => setSel(null), []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setSel(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (phase === 'loading') {
    return <div className="boot">Loading workspace.</div>;
  }
  if (phase === 'error') {
    return <div className="boot boot-err">{error}</div>;
  }

  const ctx = { data: visible, full: data, isAdam, counts, open, config: data.config };

  return (
    <div className="shell">
      <nav className="nav">
        <div className="nav-mark">ADAM STUDIOS</div>
        <div className="nav-title">Central Yards</div>
        <div className="nav-scope">
          {isAdam ? 'ADAM view, internal visible' : 'Central Yards view'}
        </div>

        {VIEWS.map((v) => (
          <button
            key={v.key}
            className={'nav-item' + (view === v.key ? ' on' : '')}
            onClick={() => setView(v.key)}
          >
            {v.name}
            {counts[v.key] > 0 ? <span className="nav-count">{counts[v.key]}</span> : null}
          </button>
        ))}

        <div className="nav-foot">
          2027 activation map, projects, tasks and pitches in one place.
          <div style={{ marginTop: 8 }}><a href="/auth/signout">Sign out</a></div>
        </div>
      </nav>

      <main className="main">
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

      <style jsx global>{`
        .boot {
          min-height: 100vh; display: grid; place-items: center;
          background: #f5f1e9; color: #6b6355; font-size: 13px;
          font-family: Geist, ui-sans-serif, system-ui, sans-serif;
        }
        .boot-err { color: #7a1f2b; max-width: 420px; text-align: center; line-height: 1.6; }
      `}</style>
    </div>
  );
}

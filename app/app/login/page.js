'use client';

import { useState, useEffect } from 'react';

export default function Login({ searchParams }) {
  const [busy, setBusy] = useState(false);
  const error = searchParams?.error;
  const next = searchParams?.next || '/';

  useEffect(() => {
    if (document.getElementById('wordmark-loader')) return;
    const s = document.createElement('script');
    s.id = 'wordmark-loader';
    s.src = '/wordmark-path.js';
    s.defer = true;
    document.body.appendChild(s);
  }, []);

  return (
    <main className="gate">
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <symbol id="adam" viewBox="0 0 2228 674" />
      </svg>
      <div className="gate-card">
        <svg className="gate-mark" viewBox="0 0 2228 674" role="img" aria-label="Adam Studios">
          <use href="#adam" />
        </svg>
        <p className="gate-eyebrow">Central Yards</p>
        <h1>Shared workspace</h1>
        <p className="gate-sub">Enter your access code to continue.</p>

        <form action="/auth/gate" method="post" onSubmit={() => setBusy(true)}>
          <input type="hidden" name="next" value={next} />
          <label htmlFor="code">Access code</label>
          <input
            id="code"
            name="code"
            type="password"
            autoComplete="off"
            autoFocus
            required
            spellCheck={false}
          />
          {error ? <p className="gate-error">{error}</p> : null}
          <button type="submit" disabled={busy}>{busy ? 'Checking' : 'Enter'}</button>
        </form>

        <p className="gate-foot">
          ADAM and Central Yards each have their own code. Ask Adam Studios if yours does not work.
        </p>
      </div>

      <style jsx>{`
        .gate {
          min-height: 100vh;
          display: grid;
          place-items: center;
          background: #f5f1e9;
          color: #000;
          font-family: "Diatype", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif;
          padding: 24px;
        }
        .gate-card { width: 100%; max-width: 400px; }
        .gate-mark { width: 132px; height: auto; display: block; color: #000; margin-bottom: clamp(28px, 5vw, 52px); }
        .gate-eyebrow {
          font-family: "DiatypeSemiMono", ui-monospace, monospace;
          font-size: 10px;
          letter-spacing: .08em;
          text-transform: uppercase;
          color: rgba(0,0,0,.58);
          margin: 0 0 12px;
        }
        h1 {
          font-size: clamp(28px, 5vw, 42px);
          font-weight: 500;
          letter-spacing: -.028em;
          line-height: 1.02;
          margin: 0 0 18px;
        }
        .gate-sub { font-size: 15px; color: rgba(0,0,0,.58); margin: 0 0 32px; line-height: 1.5; }
        label {
          display: block;
          font-family: "DiatypeSemiMono", ui-monospace, monospace;
          font-size: 9px;
          letter-spacing: .08em;
          text-transform: uppercase;
          color: rgba(0,0,0,.42);
          margin-bottom: 7px;
        }
        input {
          width: 100%;
          padding: 12px 13px;
          font-size: 15px;
          border: 1px solid rgba(0,0,0,.3);
          border-radius: 0;
          background: #f5f1e9;
          font-family: inherit;
          box-sizing: border-box;
        }
        input:focus { outline: none; border-color: #000; background: #fff; }
        button {
          width: 100%;
          margin-top: 14px;
          padding: 13px;
          background: #000;
          color: #f5f1e9;
          border: 1px solid #000;
          border-radius: 0;
          font-family: "DiatypeSemiMono", ui-monospace, monospace;
          font-size: 10px;
          letter-spacing: .12em;
          text-transform: uppercase;
          cursor: pointer;
          transition: background .15s, color .15s;
        }
        button:hover:not(:disabled) { background: #a08967; border-color: #a08967; color: #000; }
        button:disabled { opacity: .5; cursor: default; }
        .gate-error { color: #b91c1c; font-size: 12.5px; margin: 10px 0 0; }
        .gate-foot {
          font-size: 11.5px;
          color: rgba(0,0,0,.42);
          line-height: 1.6;
          margin: 34px 0 0;
          border-top: 1px solid rgba(0,0,0,.14);
          padding-top: 16px;
        }
      `}</style>
    </main>
  );
}

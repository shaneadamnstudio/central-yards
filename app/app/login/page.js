'use client';

import { useState } from 'react';

export default function Login({ searchParams }) {
  const [busy, setBusy] = useState(false);
  const error = searchParams?.error;
  const next = searchParams?.next || '/';

  return (
    <main className="gate">
      <div className="gate-card">
        <div className="gate-mark">ADAM</div>
        <h1>Central Yards</h1>
        <p className="gate-sub">Shared workspace. Enter your access code.</p>

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
          <button type="submit" disabled={busy}>
            {busy ? 'Checking' : 'Enter'}
          </button>
        </form>

        <p className="gate-foot">
          ADAM and Central Yards use different codes. Ask Adam Studios if yours
          does not work.
        </p>
      </div>

      <style jsx>{`
        .gate {
          min-height: 100vh;
          display: grid;
          place-items: center;
          background: #f5f1e9;
          color: #000;
          font-family: Geist, ui-sans-serif, system-ui, -apple-system, sans-serif;
          padding: 24px;
        }
        .gate-card {
          width: 100%;
          max-width: 380px;
          background: #fff;
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 2px;
          padding: 40px 32px 28px;
        }
        .gate-mark {
          font-size: 11px;
          letter-spacing: 0.22em;
          font-weight: 600;
          color: #a08967;
          margin-bottom: 24px;
        }
        h1 {
          font-size: 26px;
          font-weight: 500;
          letter-spacing: -0.01em;
          margin: 0 0 6px;
        }
        .gate-sub {
          font-size: 13px;
          color: #6b6355;
          margin: 0 0 28px;
          line-height: 1.5;
        }
        label {
          display: block;
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #6b6355;
          margin-bottom: 8px;
        }
        input {
          width: 100%;
          padding: 12px 14px;
          font-size: 15px;
          border: 1px solid rgba(0, 0, 0, 0.15);
          border-radius: 2px;
          background: #faf8f4;
          font-family: inherit;
          box-sizing: border-box;
        }
        input:focus {
          outline: none;
          border-color: #a08967;
          background: #fff;
        }
        button {
          width: 100%;
          margin-top: 16px;
          padding: 13px;
          background: #000;
          color: #f5f1e9;
          border: 0;
          border-radius: 2px;
          font-size: 13px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          cursor: pointer;
          font-family: inherit;
        }
        button:disabled {
          opacity: 0.55;
          cursor: default;
        }
        .gate-error {
          color: #7a1f2b;
          font-size: 12px;
          margin: 10px 0 0;
        }
        .gate-foot {
          font-size: 11px;
          color: #8a8273;
          line-height: 1.6;
          margin: 28px 0 0;
          border-top: 1px solid rgba(0, 0, 0, 0.07);
          padding-top: 16px;
        }
      `}</style>
    </main>
  );
}

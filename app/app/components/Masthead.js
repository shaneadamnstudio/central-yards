'use client';

/**
 * The masthead, matching the Supply Co. build exactly:
 * wordmark, eyebrow, big h1, lede on the left; a large count and its label
 * on the right; an optional segmented filter underneath.
 */
export default function Masthead({ eyebrow, title, lede, count, countLabel, filter, actions }) {
  return (
    <section className="masthead">
      <div>
        <svg className="wordmark" viewBox="0 0 2228 674" role="img" aria-label="Adam Studios">
          <use href="#adam" />
        </svg>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {lede ? <p className="lede">{lede}</p> : null}
        {filter ? <div className="psort" role="group">{filter}</div> : null}
        {actions ? <div style={{ marginTop: 16 }}>{actions}</div> : null}
      </div>
      {count !== undefined && count !== null ? (
        <div className="count">
          <strong>{count}</strong>
          {countLabel}
        </div>
      ) : null}
    </section>
  );
}

'use client';

import { useEffect, useRef } from 'react';

/**
 * Staggered reveal, copied from the Supply Co. build.
 *
 * Cards arrive rather than appear: 25ms apart, total stagger capped at 150ms,
 * and nothing at all for anyone who has asked their system for reduced motion.
 *
 * Three phases, because a card already carries its own spring transition:
 *   1. add .reveal-in + .in to play the entrance
 *   2. once settled, add .done so the element drops the reveal transition
 *      and returns to its own hover spring
 *   3. a safety pass picks up any card the first sweep missed, so nothing
 *      can ever be left invisible. The first card can paint before the ref
 *      is attached, which is how a card gets stranded at opacity 0.
 *
 * Usage: const ref = useReveal([dep]);  <div ref={ref}> cards use className="reveal"
 */
export default function useReveal(deps = []) {
  const ref = useRef(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timers = [];

    function settle(cards) {
      cards.forEach((c) => {
        if (c.classList.contains('done')) return;
        c.classList.add('reveal-in', 'in');
        timers.push(setTimeout(() => c.classList.add('done'), 420));
      });
    }

    function play() {
      const cards = Array.from(host.querySelectorAll('.reveal'));

      if (reduced) {
        cards.forEach((c) => c.classList.add('reveal-in', 'in', 'done'));
        return;
      }

      const per = cards.length > 1 ? Math.min(25, Math.floor(150 / cards.length)) : 0;

      cards.forEach((c, i) => {
        c.classList.remove('in', 'done', 'reveal-in');
        c.classList.add('reveal-in');
        const delay = Math.min(i * per, 150);
        timers.push(setTimeout(() => c.classList.add('in'), delay));
        timers.push(setTimeout(() => c.classList.add('done'), delay + 400));
      });

      /* safety pass: anything unmounted-but-present, or painted after the
         sweep, is brought in rather than left stranded */
      timers.push(setTimeout(() => {
        const all = Array.from(host.querySelectorAll('.reveal'));
        const stranded = all.filter((c) => !c.classList.contains('in'));
        if (stranded.length) settle(stranded);
      }, 220));
    }

    /* one frame of grace so React has committed the whole list */
    timers.push(setTimeout(play, 0));

    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}

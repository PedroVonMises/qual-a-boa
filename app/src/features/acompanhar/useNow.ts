import { useEffect, useState } from 'react';

let clock: () => number = () => Date.now();

/** Test seam: freeze or shift the clock used by countdowns and live ages. Pass undefined to restore. */
export function setNowForTests(fn?: () => number) {
  clock = fn ?? (() => Date.now());
}

export const getNow = () => clock();

/** Current time in ms, refreshed every `everyMs` (default 30 s) so countdowns stay current. */
export function useNow(everyMs = 30_000): number {
  const [now, setNow] = useState(() => clock());
  useEffect(() => {
    const t = setInterval(() => setNow(clock()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

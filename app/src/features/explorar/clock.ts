/** Injectable clock so queries keep a stable key (minute resolution) and tests can freeze time. */
export const clock = { now: (): number => Date.now() };

const STEP_MS = 15 * 60_000;

/** Coarse "now" (15 min) so the search query key stays stable while the user browses and scrolls. */
export function minuteNow(): number {
  return Math.floor(clock.now() / STEP_MS) * STEP_MS;
}

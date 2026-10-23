/** Injectable clock so queries keep a stable key (minute resolution) and tests can freeze time. */
export const clock = { now: (): number => Date.now() };

export function minuteNow(): number {
  return Math.floor(clock.now() / 60_000) * 60_000;
}

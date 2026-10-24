import { IN_PROGRESS_WINDOW_MS } from '@/domain/filters';
import { toMs, type NowLike } from '@/domain/format';
import type { EventDetail } from '@/domain/types';
import type { Resolved } from './hooks';

export type SavedEvent = Resolved<EventDetail>;

export interface SavedGroups {
  week: SavedEvent[];
  later: SavedEvent[];
  past: SavedEvent[];
}

const WEEK_MS = 7 * 86_400_000;

/** Esta semana (next 7 days) / Mais tarde / Já passaram. Missing events go with the past group. */
export function groupSaved(items: SavedEvent[], now: NowLike): SavedGroups {
  const nowMs = toMs(now);
  const out: SavedGroups = { week: [], later: [], past: [] };
  for (const it of items) {
    if (it.loading) continue;
    const t = it.data ? Date.parse(it.data.event.startsAt) : -Infinity;
    const endMs = it.data?.event.endsAt ? Date.parse(it.data.event.endsAt) : t + IN_PROGRESS_WINDOW_MS;
    if (endMs < nowMs) out.past.push(it); // still running events stay with the upcoming ones
    else if (t < nowMs + WEEK_MS) out.week.push(it);
    else out.later.push(it);
  }
  const byDate = (a: SavedEvent, b: SavedEvent) =>
    (a.data ? Date.parse(a.data.event.startsAt) : 0) - (b.data ? Date.parse(b.data.event.startsAt) : 0);
  out.week.sort(byDate);
  out.later.sort(byDate);
  out.past.sort((a, b) => byDate(b, a));
  return out;
}

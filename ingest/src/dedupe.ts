// Dedupe, cross-source merge and event lifecycle (cancelled / stale).
import type { EventItem } from '../../app/src/domain/types.js';

import type { Candidate } from './normalize.js';
import { titleSimilarity } from './text.js';

export const MERGE_WINDOW_MS = 2 * 3600_000;
export const MERGE_SIMILARITY = 0.6;
export const STALE_AFTER_MS = 24 * 3600_000;

/** Step 1: one record per (source, sourceId); the most recently fetched wins. */
export function dedupeBySourceId(cands: Candidate[]): Candidate[] {
  const m = new Map<string, Candidate>();
  for (const c of cands) {
    const prev = m.get(c.key);
    if (!prev || c.fetchedAt >= prev.fetchedAt) m.set(c.key, c);
  }
  return [...m.values()];
}

function sameShow(a: Candidate, b: Candidate): boolean {
  if (a.event.venueId !== b.event.venueId) return false;
  if (Math.abs(Date.parse(a.event.startsAt) - Date.parse(b.event.startsAt)) > MERGE_WINDOW_MS) return false;
  return titleSimilarity(a.event.title, b.event.title) >= MERGE_SIMILARITY;
}

/**
 * Step 2: cross-source fuzzy merge. Records from different sources at the same venue, starting within 2 h, with
 * token-Jaccard title similarity >= 0.6 are one event. The lowest tier number wins (ties: earlier key), the others are
 * recorded in `sources`, and only fields the winner lacks (end time, prices, artists) are filled from them.
 */
export function mergeCrossSource(cands: Candidate[]): Candidate[] {
  const sorted = [...cands].sort((a, b) => a.tier - b.tier || a.key.localeCompare(b.key));
  const kept: Candidate[] = [];
  for (const c of sorted) {
    const target = kept.find((k) => !k.sources.some((s) => s.source === c.sources[0]!.source) && sameShow(k, c));
    if (!target) {
      kept.push({ ...c, sources: [...c.sources], flags: [...c.flags] });
      continue;
    }
    target.sources.push(...c.sources);
    const e = target.event;
    const o = c.event;
    if (!e.endsAt && o.endsAt) e.endsAt = o.endsAt;
    if (e.priceMin === null && o.priceMin !== null) {
      e.priceMin = o.priceMin;
      e.priceMax = o.priceMax;
      e.isFree = o.isFree;
      target.flags = target.flags.filter((f) => f !== 'price-unknown');
    }
    if (!e.ticketUrl && o.ticketUrl) e.ticketUrl = o.ticketUrl;
    if (e.artistIds.length === 0 && o.artistIds.length) {
      e.artistIds = [...o.artistIds];
      target.artists = [...c.artists];
    }
    if (o.status === 'cancelled' && e.status !== 'cancelled' && c.tier === target.tier) e.status = 'cancelled';
    target.flags.push(`merged:${c.key}`);
  }
  return kept;
}

export interface LifecycleInput {
  now: Date;
  /** Events of the previous feed (EventItem). */
  previous: EventItem[];
  /** Ids of previous events whose source page disappeared (404/410). */
  goneIds: Set<string>;
}

const endOf = (e: Pick<EventItem, 'startsAt' | 'endsAt'>) => Date.parse(e.endsAt ?? e.startsAt);

/** True when the event ended more than 24 h before `now`. */
export const isStale = (e: Pick<EventItem, 'startsAt' | 'endsAt'>, now: Date) => endOf(e) < now.getTime() - STALE_AFTER_MS;

/**
 * Applies lifecycle rules to the final event list:
 * - events whose source page is gone become `cancelled` (kept visible so users see the cancellation);
 * - events ended more than 24 h ago are dropped from the feed (history lives in the DB later).
 * `fresh` events come from this run; `previous` events not re-produced by this run are carried forward.
 */
export function applyLifecycle(fresh: EventItem[], input: LifecycleInput, carryForward: boolean): { events: EventItem[]; dropped: string[]; cancelled: string[] } {
  const byId = new Map<string, EventItem>();
  if (carryForward) for (const p of input.previous) byId.set(p.id, p);
  for (const f of fresh) byId.set(f.id, f);
  const cancelled: string[] = [];
  for (const id of input.goneIds) {
    const e = byId.get(id);
    if (e && e.status !== 'cancelled') {
      byId.set(id, { ...e, status: 'cancelled' });
      cancelled.push(id);
    }
  }
  const dropped: string[] = [];
  const events: EventItem[] = [];
  for (const e of byId.values()) {
    if (isStale(e, input.now)) dropped.push(e.id);
    else events.push(e);
  }
  return { events, dropped, cancelled };
}

import type { Scored } from '@/domain/recommendTypes';
import type { SearchItem, Venue } from '@/domain/types';

export interface VenuePin {
  venue: Venue;
  items: SearchItem[];
  /** Top-ranked venue under the `recommended` sort. */
  recommended?: boolean;
  /** 1-based position by best score under the `recommended` sort. */
  rank?: number;
}

/** How many venues carry the recommended badge. */
export const RECOMMENDED_PINS = 3;

/** One pin per open venue with at least one published upcoming event. Closed venues are dropped. */
export function groupByVenue(items: SearchItem[], ranked?: Scored[]): VenuePin[] {
  if (ranked) return groupByScore(items, ranked);
  const byVenue = new Map<string, VenuePin>();
  for (const it of items) {
    if (it.venue.status === 'closed' || it.event.status !== 'published') continue;
    const pin = byVenue.get(it.venue.id);
    if (pin) pin.items.push(it);
    else byVenue.set(it.venue.id, { venue: it.venue, items: [it] });
  }
  return [...byVenue.values()].sort((a, b) => a.venue.name.localeCompare(b.venue.name));
}

export const pinLabel = (pin: VenuePin) =>
  `${pin.venue.name}, ${pin.items.length} ${pin.items.length === 1 ? 'evento' : 'eventos'}`;

/**
 * Same grouping, ordered by each venue's best score; events inside a pin follow their score too.
 * The top RECOMMENDED_PINS venues are flagged. Items absent from `ranked` sort last.
 */
function groupByScore(items: SearchItem[], ranked: Scored[]): VenuePin[] {
  const pos = new Map(ranked.map((s, i) => [s.item.event.id, i]));
  const at = (it: SearchItem) => pos.get(it.event.id) ?? Number.MAX_SAFE_INTEGER;
  const pins = groupByVenue(items);
  for (const p of pins) p.items.sort((a, b) => at(a) - at(b));
  pins.sort((a, b) => at(a.items[0]) - at(b.items[0]) || a.venue.name.localeCompare(b.venue.name));
  pins.forEach((p, i) => {
    p.rank = i + 1;
    if (i < RECOMMENDED_PINS && at(p.items[0]) !== Number.MAX_SAFE_INTEGER) p.recommended = true;
  });
  return pins;
}

import type { SearchItem, Venue } from '@/domain/types';

export interface VenuePin {
  venue: Venue;
  items: SearchItem[];
  recommended?: boolean;
  rank?: number;
}

/** One pin per open venue with at least one published upcoming event. Closed venues are dropped. */
export function groupByVenue(items: SearchItem[]): VenuePin[] {
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

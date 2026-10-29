import { defaultFilters, RADIUS_OPTIONS, toSearchParams } from '@/domain/filters';
import type { GeoPoint, SearchItem, SearchParams, Venue } from '@/domain/types';
import { searchKey } from '@/state/searchHistory';

export type ResultKind = 'tudo' | 'eventos' | 'casas' | 'artistas';

/** Max events fetched for one search. Search ignores the user's radius and uses the widest stop. */
export const SEARCH_LIMIT = 30;
export const SEARCH_RADIUS_KM = RADIUS_OPTIONS[RADIUS_OPTIONS.length - 1];

/** Repo params for a free-text search: every upcoming date, widest radius, soonest first. */
export function buscaParams(query: string, location: Pick<GeoPoint, 'lat' | 'lng'>, nowMs: number): Omit<SearchParams, 'cursor'> {
  const p = toSearchParams(
    { ...defaultFilters, genreSlugs: [], radiusKm: SEARCH_RADIUS_KM, sort: 'date', query },
    location,
    nowMs,
  );
  return { ...p, limit: SEARCH_LIMIT };
}

export interface VenueHit {
  venue: Venue;
  distanceKm: number;
  upcoming: number;
}

/**
 * Venues whose name or neighbourhood matches the query, taken from the event results
 * (the repo matches title, venue and artist), nearest first.
 */
export function venueHits(items: SearchItem[], query: string): VenueHit[] {
  const q = searchKey(query);
  if (!q) return [];
  const byId = new Map<string, VenueHit>();
  for (const it of items) {
    const v = it.venue;
    if (!searchKey(v.name).includes(q) && !searchKey(v.area).includes(q)) continue;
    const hit = byId.get(v.id);
    if (hit) hit.upcoming += 1;
    else byId.set(v.id, { venue: v, distanceKm: it.distanceKm, upcoming: 1 });
  }
  return [...byId.values()].sort((a, b) => a.distanceKm - b.distanceKm);
}

export const KIND_LABELS: Record<ResultKind, string> = {
  tudo: 'Tudo',
  eventos: 'Eventos',
  casas: 'Casas',
  artistas: 'Artistas',
};

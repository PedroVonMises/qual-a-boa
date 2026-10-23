import { haversineKm } from '@/domain/geo';
import {
  DEFAULT_LOCATION,
  type Artist,
  type ArtistDetail,
  type EventDetail,
  type EventItem,
  type GeoPoint,
  type Genre,
  type PastArtist,
  type SearchItem,
  type SearchPage,
  type SearchParams,
  type SeedDataset,
  type Venue,
  type VenueDetail,
} from '@/domain/types';
import type { Repo } from './repo';

/** Lowercase + strip accents, for case/accent-insensitive substring search. */
export function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

const DEFAULT_LIMIT = 20;

function sortPriceKey(e: EventItem): number {
  if (e.isFree) return 0;
  if (e.priceMin == null) return Number.POSITIVE_INFINITY;
  return e.priceMin;
}

function compareItems(sort: SearchParams['sort']) {
  return (a: SearchItem, b: SearchItem): number => {
    let c = 0;
    switch (sort) {
      case 'distance':
        c = a.distanceKm - b.distanceKm;
        break;
      case 'price': {
        const pa = sortPriceKey(a.event);
        const pb = sortPriceKey(b.event);
        c = pa === pb ? 0 : pa < pb ? -1 : 1;
        break;
      }
      case 'date':
        c = 0;
        break;
      case 'popularity':
        c = b.event.popularity - a.event.popularity;
        break;
    }
    if (c !== 0) return c;
    const t = Date.parse(a.event.startsAt) - Date.parse(b.event.startsAt);
    if (t !== 0) return t;
    return a.event.id < b.event.id ? -1 : a.event.id > b.event.id ? 1 : 0;
  };
}

export class SeedRepo implements Repo {
  private readonly venuesById = new Map<string, Venue>();
  private readonly artistsById = new Map<string, Artist>();

  constructor(
    private readonly data: SeedDataset,
    private readonly clock: () => number = Date.now,
  ) {
    for (const v of data.venues) this.venuesById.set(v.id, v);
    for (const a of data.artists) this.artistsById.set(a.id, a);
  }

  async listGenres(): Promise<Genre[]> {
    return [...this.data.genres];
  }

  async listAreas(): Promise<string[]> {
    const areas = new Set<string>();
    for (const v of this.data.venues) if (v.status !== 'closed') areas.add(v.area);
    return [...areas].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  async searchEvents(params: SearchParams): Promise<SearchPage> {
    const nowMs = params.now ? Date.parse(params.now) : this.clock();
    const fromMs = params.dateFrom ? Date.parse(params.dateFrom) : nowMs;
    const toMs = params.dateTo ? Date.parse(params.dateTo) : null;
    const genres = params.genreSlugs?.length ? new Set(params.genreSlugs) : null;
    const area = params.area ? params.area.toLowerCase() : null;
    const q = params.query?.trim() ? normalizeText(params.query.trim()) : null;

    const items: SearchItem[] = [];
    for (const event of this.data.events) {
      if (event.status !== 'published') continue;
      const startMs = Date.parse(event.startsAt);
      if (startMs < fromMs) continue;
      if (toMs != null && startMs > toMs) continue;
      const venue = this.venuesById.get(event.venueId);
      if (!venue || venue.status === 'closed') continue;
      const distanceKm = haversineKm(params.lat, params.lng, venue.lat, venue.lng);
      if (distanceKm > params.radiusKm) continue;
      if (genres && !event.genreSlugs.some((g) => genres.has(g))) continue;
      if (params.priceMax != null) {
        if (params.priceMax === 0) {
          if (!event.isFree) continue;
        } else if (!event.isFree && (event.priceMin == null || event.priceMin > params.priceMax)) {
          continue;
        }
      }
      if (params.artistId && !event.artistIds.includes(params.artistId)) continue;
      if (area && venue.area.toLowerCase() !== area) continue;
      if (q) {
        const hay = [event.title, venue.name, ...event.artistIds.map((id) => this.artistsById.get(id)?.name ?? '')];
        if (!hay.some((s) => normalizeText(s).includes(q))) continue;
      }
      items.push({ event, venue, distanceKm: Math.round(distanceKm * 1000) / 1000 });
    }

    items.sort(compareItems(params.sort));

    const limit = params.limit ?? DEFAULT_LIMIT;
    const parsed = Number.parseInt(params.cursor ?? '0', 10);
    const offset = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    const page = items.slice(offset, offset + limit);
    const next = offset + limit;
    return { items: page, total: items.length, nextCursor: next < items.length ? String(next) : null };
  }

  async getEvent(id: string, from?: GeoPoint): Promise<EventDetail | null> {
    const event = this.data.events.find((e) => e.id === id);
    if (!event || event.status === 'draft') return null;
    const venue = this.venuesById.get(event.venueId);
    if (!venue) return null;
    const lineup = event.artistIds.map((a) => this.artistsById.get(a)).filter((a): a is Artist => !!a);
    return {
      event,
      venue,
      lineup,
      distanceKm: from ? haversineKm(from.lat, from.lng, venue.lat, venue.lng) : null,
    };
  }

  async getVenue(slug: string): Promise<VenueDetail | null> {
    const venue = this.data.venues.find((v) => v.slug === slug);
    if (!venue) return null;
    const nowMs = this.clock();
    const here = this.data.events.filter((e) => e.venueId === venue.id && e.status === 'published');
    const upcoming = here
      .filter((e) => Date.parse(e.startsAt) >= nowMs)
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || (a.id < b.id ? -1 : 1));

    const byArtist = new Map<string, { lastMs: number; last: string; times: number }>();
    for (const e of here) {
      const ms = Date.parse(e.startsAt);
      if (ms >= nowMs) continue;
      for (const aid of new Set(e.artistIds)) {
        const cur = byArtist.get(aid);
        if (!cur) byArtist.set(aid, { lastMs: ms, last: e.startsAt, times: 1 });
        else {
          cur.times += 1;
          if (ms > cur.lastMs) {
            cur.lastMs = ms;
            cur.last = e.startsAt;
          }
        }
      }
    }
    const pastArtists: PastArtist[] = [];
    for (const [aid, v] of byArtist) {
      const artist = this.artistsById.get(aid);
      if (artist) pastArtists.push({ artist, lastPlayedAt: v.last, times: v.times });
    }
    pastArtists.sort(
      (a, b) =>
        Date.parse(b.lastPlayedAt) - Date.parse(a.lastPlayedAt) || (a.artist.id < b.artist.id ? -1 : 1),
    );
    return { venue, upcoming, pastArtists };
  }

  async getArtist(slug: string, from?: GeoPoint): Promise<ArtistDetail | null> {
    const artist = this.data.artists.find((a) => a.slug === slug);
    if (!artist) return null;
    const origin = from ?? DEFAULT_LOCATION;
    const nowMs = this.clock();

    const upcoming: SearchItem[] = [];
    const lastByVenue = new Map<string, string>();
    for (const event of this.data.events) {
      if (event.status !== 'published' || !event.artistIds.includes(artist.id)) continue;
      const venue = this.venuesById.get(event.venueId);
      if (!venue) continue;
      const ms = Date.parse(event.startsAt);
      if (ms >= nowMs) {
        if (venue.status !== 'closed') {
          upcoming.push({ event, venue, distanceKm: haversineKm(origin.lat, origin.lng, venue.lat, venue.lng) });
        }
      } else {
        const prev = lastByVenue.get(venue.id);
        if (!prev || Date.parse(prev) < ms) lastByVenue.set(venue.id, event.startsAt);
      }
    }
    upcoming.sort(compareItems('date'));
    const playedAt = [...lastByVenue.entries()]
      .map(([vid, lastPlayedAt]) => ({ venue: this.venuesById.get(vid)!, lastPlayedAt }))
      .sort((a, b) => Date.parse(b.lastPlayedAt) - Date.parse(a.lastPlayedAt) || (a.venue.id < b.venue.id ? -1 : 1));
    return { artist, upcoming, playedAt };
  }

  async searchArtists(query: string, limit = 10): Promise<Artist[]> {
    const q = normalizeText(query.trim());
    if (!q) return [];
    return this.data.artists
      .filter((a) => normalizeText(a.name).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      .slice(0, limit);
  }
}

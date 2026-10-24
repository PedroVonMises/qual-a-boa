// RawEvent -> Candidate (EventItem + Venue + Artists in the app's shape).
import type { Artist, EventItem, Venue, VenueStatus } from '../../app/src/domain/types.js';

import { artistId, eventId, sortGenres, slugify, venueId } from './ids.js';
import { HTTPS_RE, toUTC } from './parse.js';
import { fold, jaccard } from './text.js';
import type { RawEvent } from './types.js';

// ---------------------------------------------------------------------------
// Venue catalog + matching
// ---------------------------------------------------------------------------
export interface VenueEntry {
  /** slug; the Venue id is venueId(slug), identical to the app seed */
  id: string;
  name: string;
  aliases?: string[];
  address?: string;
  area: string;
  city: string;
  lat: number;
  lng: number;
  genreSlugs: string[];
  status: VenueStatus;
  adultOnly?: boolean;
  hours?: string;
}

const GENERIC = new Set(['bar', 'boate', 'club', 'clube', 'casa', 'de', 'da', 'do', 'dos', 'das', 'shows', 'show', 'espaco', 'e', 'the', 'a', 'o', 'lounge', 'music', 'eventos', 'vitoria', 'es', 'vila', 'velha']);
const ADDR_GENERIC = new Set(['rua', 'r', 'av', 'avenida', 'de', 'da', 'do', 'dos', 'das', 'vitoria', 'vila', 'velha', 'es', 'brasil', 'centro', 'praia', 'jardim', 'penha', 'canto', 'est', 'estrada', 'n']);

const words = (s: string) => fold(s).split(/[^a-z0-9]+/).filter(Boolean);
export function venueCoreTokens(name: string): string[] {
  const all = words(name);
  const core = all.filter((w) => !GENERIC.has(w));
  return core.length ? core : all;
}
function addressTokens(addr: string): string[] {
  const street = addr.split(/\s+-\s+/)[0] ?? addr;
  return words(street).filter((w) => !ADDR_GENERIC.has(w));
}

export interface VenueMatch { entry: VenueEntry; how: 'name' | 'alias' | 'address' }

export class VenueIndex {
  constructor(readonly entries: VenueEntry[]) {}

  match(name: string, address?: string): VenueMatch | null {
    const ev = venueCoreTokens(name);
    for (const entry of this.entries) {
      const candidates = [entry.name, ...(entry.aliases ?? [])];
      for (let i = 0; i < candidates.length; i++) {
        const c = venueCoreTokens(candidates[i]!);
        const how = i === 0 ? 'name' : 'alias';
        if (c.join(' ') === ev.join(' ')) return { entry, how };
      }
    }
    for (const entry of this.entries) {
      const candidates = [entry.name, ...(entry.aliases ?? [])];
      for (let i = 0; i < candidates.length; i++) {
        const c = venueCoreTokens(candidates[i]!);
        const joined = c.join('');
        const subset = c.every((t) => ev.includes(t)) && joined.length >= 4;
        if (subset || jaccard(c, ev) >= 0.8) return { entry, how: i === 0 ? 'name' : 'alias' };
      }
    }
    if (address) {
      const ea = addressTokens(address);
      if (ea.length) {
        for (const entry of this.entries) {
          if (!entry.address) continue;
          const va = addressTokens(entry.address);
          const nums = va.filter((t) => /^\d+$/.test(t));
          const sameNums = nums.every((n) => ea.includes(n));
          if (va.length && sameNums && jaccard(va, ea) >= 0.6) return { entry, how: 'address' };
        }
      }
    }
    return null;
  }
}

const CITY_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  vitoria: { lat: -20.3155, lng: -40.3128 },
  'vila velha': { lat: -20.3297, lng: -40.2925 },
  serra: { lat: -20.1210, lng: -40.3074 },
  cariacica: { lat: -20.2632, lng: -40.4165 },
  viana: { lat: -20.3903, lng: -40.4936 },
  guarapari: { lat: -20.6772, lng: -40.4986 },
};
const DEFAULT_CITY = 'Vitória';

export function guessCity(text: string | undefined): string {
  const f = fold(text ?? '');
  for (const key of ['vila velha', 'serra', 'cariacica', 'viana', 'guarapari', 'vitoria']) {
    if (new RegExp(`(^|[^a-z])${key}([^a-z]|$)`).test(f)) return key === 'vitoria' ? 'Vitória' : key.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return DEFAULT_CITY;
}

export type Geocoder = (query: string) => Promise<{ lat: number; lng: number } | null>;

// ---------------------------------------------------------------------------
// Genres
// ---------------------------------------------------------------------------
export type GenreKeywords = Record<string, string[] | string>;

export function classifyGenres(text: string, keywords: GenreKeywords, venueGenres: string[]): string[] {
  const hay = ' ' + fold(text).replace(/[^a-z0-9&]+/g, ' ') + ' ';
  const scores: [string, number][] = [];
  for (const [slug, kws] of Object.entries(keywords)) {
    if (slug.startsWith('_') || !Array.isArray(kws)) continue;
    let n = 0;
    for (const kw of kws) {
      const k = fold(kw).replace(/[^a-z0-9&]+/g, ' ').trim();
      if (k && (hay.includes(` ${k} `) || hay.includes(` ${k}s `))) n++;
    }
    if (n > 0) scores.push([slug, n]);
  }
  if (scores.length) {
    scores.sort((a, b) => b[1] - a[1]);
    return sortGenres(scores.slice(0, 3).map(([s]) => s));
  }
  return sortGenres(venueGenres.slice(0, 2));
}

// ---------------------------------------------------------------------------
// Artists: only explicit
// ---------------------------------------------------------------------------
const NOT_ARTIST = /\b(open bar|entrada|ingresso|lote|vip|pista|camarote|dj residente|banda|convidados?|participacao|especial|muito mais|e mais|mais atracoes)\b/;

function plausibleName(n: string): boolean {
  const t = n.trim();
  if (t.length < 2 || t.length > 40) return false;
  if (t.split(/\s+/).length > 5) return false;
  if (!/^[A-ZÀ-Ý0-9]/.test(t)) return false;
  if (NOT_ARTIST.test(fold(t))) return false;
  if (/[.!?:@#/\\]|r\$/i.test(t)) return false;
  return true;
}

/** Names from "com A, B e C" patterns in a line of text. Returns [] unless every item looks like a name. */
export function artistsFromText(text: string): string[] {
  const m = text.match(/\bcom\s+([^.!?\n|()–—]+?)\s*(?:[.!?\n|()–—]|$)/i);
  if (!m) return [];
  const list = m[1]!.split(/\s*(?:,|;|\s+e\s+|\s+&\s+)\s*/).map((x) => x.trim()).filter(Boolean);
  if (!list.length || list.length > 8) return [];
  return list.every(plausibleName) ? list : [];
}

// ---------------------------------------------------------------------------
// Popularity (documented in README): 0..100, derived only from what we know.
//   base 50 | +5 official/tier-1 source | +10 top price >= R$120, +5 >= R$60 | +4 per listed artist (max +12) | free: -0 | clamp
// ---------------------------------------------------------------------------
export function popularityOf(opts: { tier: number; priceMax: number | null; artistCount: number }): number {
  let p = 50;
  if (opts.tier === 1) p += 5;
  if (opts.priceMax !== null) p += opts.priceMax >= 120 ? 10 : opts.priceMax >= 60 ? 5 : 0;
  p += Math.min(3, opts.artistCount) * 4;
  return Math.max(0, Math.min(100, p));
}

// ---------------------------------------------------------------------------
// Candidate
// ---------------------------------------------------------------------------
export interface SourceRef { source: string; sourceId: string; url: string; tier: number }

export interface Candidate {
  /** `source:sourceId` of the primary record. */
  key: string;
  tier: 1 | 2 | 3;
  sources: SourceRef[];
  event: EventItem;
  venue: Venue;
  venueMatched: boolean;
  artists: Artist[];
  /** Human review hints: venue-unverified, price-unknown, ... */
  flags: string[];
  fetchedAt: string;
  /** Title and raw status kept for dedupe/lifecycle. */
  rawStatus: string;
}

export interface NormalizeDeps {
  venues: VenueIndex;
  keywords: GenreKeywords;
  tier: (source: string) => 1 | 2 | 3;
  geocode?: Geocoder;
}

export type NormalizeResult = { ok: true; candidate: Candidate } | { ok: false; reason: string };

function draftVenue(raw: RawEvent, geo: { lat: number; lng: number } | null): Venue {
  const city = guessCity(raw.venueAddress);
  const c = geo ?? CITY_CENTROIDS[fold(city)] ?? CITY_CENTROIDS['vitoria']!;
  const slug = slugify(raw.venueName);
  const v: Venue = {
    id: venueId(slug),
    slug,
    name: raw.venueName.trim(),
    area: city,
    city,
    lat: c.lat,
    lng: c.lng,
    status: 'unverified',
    adultOnly: true,
    genreSlugs: [],
    coverKey: 'generic',
    placeholder: false,
  };
  if (raw.venueAddress) v.address = raw.venueAddress;
  return v;
}

function venueFromEntry(e: VenueEntry): Venue {
  const v: Venue = {
    id: venueId(e.id),
    slug: e.id,
    name: e.name,
    area: e.area,
    city: e.city,
    lat: e.lat,
    lng: e.lng,
    status: e.status,
    adultOnly: e.adultOnly ?? true,
    genreSlugs: sortGenres(e.genreSlugs),
    coverKey: 'generic',
    placeholder: false,
  };
  if (e.address) v.address = e.address;
  if (e.hours) v.hours = e.hours;
  return v;
}

export async function normalizeEvent(raw: RawEvent, deps: NormalizeDeps): Promise<NormalizeResult> {
  const startsAt = toUTC(raw.startsAt);
  if (!startsAt) return { ok: false, reason: `invalid startsAt "${raw.startsAt}"` };
  let endsAt = raw.endsAt ? toUTC(raw.endsAt) : null;
  if (endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) endsAt = null;
  const title = raw.title.trim();
  if (!title) return { ok: false, reason: 'empty title' };
  if (!raw.venueName.trim()) return { ok: false, reason: 'empty venue' };

  const flags: string[] = [];
  const m = deps.venues.match(raw.venueName, raw.venueAddress);
  let venue: Venue;
  if (m) venue = venueFromEntry(m.entry);
  else {
    let geo: { lat: number; lng: number } | null = null;
    if (deps.geocode) geo = await deps.geocode([raw.venueName, raw.venueAddress, 'Espírito Santo, Brasil'].filter(Boolean).join(', '));
    venue = draftVenue(raw, geo);
    flags.push('venue-unverified');
    if (!geo) flags.push('venue-location-approximate');
  }

  // price
  let priceMin: number | null = null;
  let priceMax: number | null = null;
  let isFree = false;
  if (raw.isFree === true) { priceMin = 0; priceMax = 0; isFree = true; }
  else if (raw.priceMin !== undefined || raw.priceMax !== undefined) {
    const lo = raw.priceMin ?? raw.priceMax!;
    const hi = raw.priceMax ?? raw.priceMin!;
    priceMin = Math.min(lo, hi);
    priceMax = Math.max(lo, hi);
    isFree = raw.isFree ?? priceMax === 0;
  } else flags.push('price-unknown');

  // genres
  const text = `${title} ${raw.description ?? ''}`;
  const genreSlugs = classifyGenres(text, deps.keywords, venue.genreSlugs);

  // artists: only explicit
  const names = raw.lineup?.length ? raw.lineup : artistsFromText(title).length ? artistsFromText(title) : artistsFromText(raw.description ?? '');
  const seen = new Set<string>();
  const artists: Artist[] = [];
  for (const n of names) {
    const slug = slugify(n);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    artists.push({ id: artistId(slug), slug, name: n.trim(), genreSlugs });
  }

  const tier = deps.tier(raw.source);
  const key = `${raw.source}:${raw.sourceId}`;
  const event: EventItem = {
    id: eventId(key),
    title,
    venueId: venue.id,
    startsAt,
    ...(endsAt && { endsAt }),
    priceMin,
    priceMax,
    isFree,
    ageMin: raw.ageMin ?? 18,
    genreSlugs,
    artistIds: artists.map((a) => a.id),
    status: raw.status === 'cancelled' ? 'cancelled' : 'published',
    coverKey: 'generic',
    popularity: popularityOf({ tier, priceMax, artistCount: artists.length }),
  } as EventItem;
  if (raw.url && HTTPS_RE.test(raw.url)) event.ticketUrl = raw.url;
  else if (raw.url) flags.push('ticket-url-not-https');
  else flags.push('no-ticket-url');
  if (raw.imageUrl && tier === 1 && HTTPS_RE.test(raw.imageUrl)) event.imageUrl = raw.imageUrl; // partner-supplied only

  return {
    ok: true,
    candidate: {
      key,
      tier,
      sources: [{ source: raw.source, sourceId: raw.sourceId, url: raw.url, tier }],
      event,
      venue,
      venueMatched: !!m,
      artists,
      flags,
      fetchedAt: raw.fetchedAt,
      rawStatus: raw.status ?? 'scheduled',
    },
  };
}

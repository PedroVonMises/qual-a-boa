/**
 * Edge/Serverless Catalog API engine (100% runtime-agnostic: works in Vercel Edge/Node, Bun, Deno, and Jest).
 * - Separates read-heavy catalog discovery from dynamic user mutations.
 * - Enforces strict pagination (limit <= 50), lean card payloads, input sanitization, CORS, ETag, Cache-Control, and rate limiting.
 */
import { hashString, localFallbackCoverPath } from '../domain/cover';
import { haversineKm } from '../domain/geo';
import { DEFAULT_LOCATION, type EventItem, type SeedDataset, type Venue } from '../domain/types';
import { foldVenueText, isPriceRange } from '../domain/venueSchema';
import { MetricsCollector } from './logger';
import { RateLimiter } from './rateLimit';

export const API_DEFAULT_LIMIT = 20;
export const API_MAX_LIMIT = 50;
export const MAX_QUERY_LEN = 120;

export interface ApiRequest {
  method: string;
  path: string;
  query: Record<string, string | undefined>;
  headers: Record<string, string | undefined>;
  clientIp: string;
}

export interface ApiResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

/** Lean venue list card payload (omits heavy/internal fields to keep responses small under 10k concurrency). */
export interface LeanVenueCard {
  id: string;
  slug: string;
  name: string;
  area: string;
  city: string;
  uf: string;
  lat: number;
  lng: number;
  status: Venue['status'];
  genreSlugs: string[];
  priceRange: string;
  hours?: string;
  coverKey: string;
  fallbackCover: string;
  distanceKm?: number;
}

/** Lean event list card payload. */
export interface LeanEventCard {
  id: string;
  title: string;
  startsAt: string;
  priceMin: number | null;
  priceMax: number | null;
  isFree: boolean;
  genreSlugs: string[];
  coverKey: string;
  fallbackCover: string;
  popularity: number;
  venue: {
    id: string;
    slug: string;
    name: string;
    area: string;
    city: string;
    lat: number;
    lng: number;
  };
  distanceKm: number;
}

interface IndexedVenue {
  venue: Venue;
  foldedName: string;
  foldedArea: string;
  foldedCity: string;
  fallbackCover: string;
}

interface IndexedEvent {
  event: EventItem;
  venue: Venue;
  startMs: number;
  foldedSearch: string;
  fallbackCover: string;
  effectiveTags: string[];
}

/** Fast, deterministic 64-bit hex ETag using pure FNV-1a avalanche hashes (zero Node crypto dependency). */
function computeEtag(input: string): string {
  const h1 = hashString(input).toString(16).padStart(8, '0');
  const h2 = hashString(`${input.length}:${input}`).toString(16).padStart(8, '0');
  return `"${h1}${h2}"`;
}

function runtimeStats(): { node: string; rssMb: number; heapUsedMb: number } {
  const proc = (globalThis as { process?: { version?: string; memoryUsage?: () => { rss: number; heapUsed: number } } }).process;
  const mem = proc?.memoryUsage?.();
  return {
    node: proc?.version ?? 'edge',
    rssMb: mem ? Math.round((mem.rss / 1024 / 1024) * 10) / 10 : 0,
    heapUsedMb: mem ? Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10 : 0,
  };
}

export function sanitizeTextParam(v: string | undefined, maxLen = MAX_QUERY_LEN): string | undefined {
  if (!v) return undefined;
  // Strip ASCII control characters and trim.
  const cleaned = v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maxLen);
  return cleaned.length > 0 ? cleaned : undefined;
}

function clampNumber(v: string | undefined, min: number, max: number, fallback: number): number {
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function parseIntClamp(v: string | undefined, min: number, max: number, fallback: number): number {
  if (v === undefined || v === '') return fallback;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

export interface CatalogEngineOptions {
  dataset: SeedDataset;
  /** Rate limit requests per minute per IP on catalog endpoints. */
  rateLimitPerMin?: number;
  /** Optional list of allowed CORS origins (defaults to '*' for public read-only catalog endpoints). */
  allowedOrigins?: string[];
  /** Disable response cache (for unit tests). */
  disableResponseCache?: boolean;
}

const SECURITY_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

export class CatalogEngine {
  readonly etag: string;
  readonly dataset: SeedDataset;
  readonly metrics = new MetricsCollector();
  readonly limiter: RateLimiter;
  private readonly venues: IndexedVenue[];
  private readonly venueBySlug = new Map<string, Venue>();
  private readonly events: IndexedEvent[];
  private readonly eventById = new Map<string, EventItem>();
  private readonly allowedOrigins: string[] | null;
  private readonly responseCache = new Map<string, { body: string; etag: string; expiresAt: number }>();
  private readonly disableResponseCache: boolean;

  constructor(opts: CatalogEngineOptions) {
    this.dataset = opts.dataset;
    this.etag = computeEtag(`${opts.dataset.generatedAt}:${opts.dataset.venues.length}:${opts.dataset.events.length}`);
    this.limiter = new RateLimiter({ maxRequests: opts.rateLimitPerMin ?? 240, windowMs: 60_000 });
    this.allowedOrigins = opts.allowedOrigins?.length ? opts.allowedOrigins : null;
    this.disableResponseCache = Boolean(opts.disableResponseCache);

    const venueById = new Map<string, Venue>();
    const artistById = new Map(opts.dataset.artists.map((a) => [a.id, a]));

    this.venues = opts.dataset.venues.map((venue) => {
      venueById.set(venue.id, venue);
      this.venueBySlug.set(venue.slug, venue);
      return {
        venue,
        foldedName: foldVenueText(venue.name),
        foldedArea: foldVenueText(venue.area),
        foldedCity: foldVenueText(venue.city),
        fallbackCover: localFallbackCoverPath(venue.genreSlugs),
      };
    });

    const indexedEvents: IndexedEvent[] = [];
    for (const event of opts.dataset.events) {
      this.eventById.set(event.id, event);
      const venue = venueById.get(event.venueId);
      if (!venue) continue;
      const artistNames = event.artistIds.map((id) => artistById.get(id)?.name ?? '').join(' ');
      indexedEvents.push({
        event,
        venue,
        startMs: Date.parse(event.startsAt),
        foldedSearch: foldVenueText(`${event.title} ${venue.name} ${venue.area} ${artistNames}`),
        fallbackCover: localFallbackCoverPath(event.genreSlugs),
        effectiveTags: [...new Set([...(venue.accessTags ?? []), ...(event.accessTags ?? [])])],
      });
    }
    this.events = indexedEvents;
  }

  private corsHeaders(origin: string | undefined): Record<string, string> {
    if (!this.allowedOrigins) {
      return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, If-None-Match',
      };
    }
    const matched = origin && this.allowedOrigins.includes(origin) ? origin : this.allowedOrigins[0];
    return {
      'Access-Control-Allow-Origin': matched,
      Vary: 'Origin',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, If-None-Match',
    };
  }

  handle(req: ApiRequest): ApiResponse {
    const start = performance.now();
    const method = req.method.toUpperCase();
    const origin = req.headers.origin ?? req.headers.Origin;
    const cors = this.corsHeaders(origin);

    if (method === 'OPTIONS') {
      const res: ApiResponse = { status: 204, headers: { ...SECURITY_HEADERS, ...cors }, body: '' };
      this.metrics.record({ route: req.path, method, status: 204, latencyMs: performance.now() - start, cache: 'BYPASS' });
      return res;
    }

    if (method !== 'GET' && method !== 'HEAD') {
      const body = JSON.stringify({ error: 'Method not allowed' });
      const res: ApiResponse = { status: 405, headers: { ...SECURITY_HEADERS, ...cors, Allow: 'GET, HEAD, OPTIONS' }, body };
      this.metrics.record({ route: req.path, method, status: 405, latencyMs: performance.now() - start, cache: 'BYPASS', error: 'method_not_allowed' });
      return res;
    }

    // Healthcheck bypasses rate limit & caching so orchestrators/monitors always get fresh status.
    if (req.path === '/api/health') {
      const snap = this.metrics.snapshot();
      const rt = runtimeStats();
      const healthy = this.venues.length >= 200;
      const payload = {
        status: healthy ? 'ok' : 'degraded',
        service: 'qual-a-boa',
        timestamp: new Date().toISOString(),
        catalog: {
          generatedAt: this.dataset.generatedAt,
          venues: this.venues.length,
          events: this.events.length,
          artists: this.dataset.artists.length,
          genres: this.dataset.genres.length,
        },
        runtime: {
          ...rt,
          uptimeSec: snap.uptimeSec,
        },
        metrics: snap,
      };
      const status = healthy ? 200 : 503;
      const body = method === 'HEAD' ? '' : JSON.stringify(payload);
      const res: ApiResponse = {
        status,
        headers: { ...SECURITY_HEADERS, ...cors, 'Cache-Control': 'no-store' },
        body,
      };
      this.metrics.record({ route: '/api/health', method, status, latencyMs: performance.now() - start, cache: 'BYPASS' });
      return res;
    }

    // Rate limiting on catalog routes.
    const decision = this.limiter.check(req.clientIp || 'unknown');
    const rlHeaders = this.limiter.headers(decision);
    if (!decision.allowed) {
      const body = JSON.stringify({
        error: 'Muitas requisições em sequência. Aguarde alguns segundos e tente novamente.',
        code: 'RATE_LIMITED',
        retryAfterSec: decision.retryAfterSec,
      });
      const res: ApiResponse = {
        status: 429,
        headers: { ...SECURITY_HEADERS, ...cors, ...rlHeaders, 'Cache-Control': 'no-store' },
        body,
      };
      this.metrics.record({ route: req.path, method, status: 429, latencyMs: performance.now() - start, cache: 'BYPASS', error: 'rate_limited' });
      return res;
    }

    // Check edge response cache for GET queries.
    const cacheKey = `${req.path}?${Object.keys(req.query)
      .sort()
      .map((k) => `${k}=${req.query[k] ?? ''}`)
      .join('&')}`;
    const inm = req.headers['if-none-match'] ?? req.headers['If-None-Match'];

    if (!this.disableResponseCache) {
      const cached = this.responseCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        if (inm && inm === cached.etag) {
          const res: ApiResponse = {
            status: 304,
            headers: {
              ...SECURITY_HEADERS,
              ...cors,
              ...rlHeaders,
              ETag: cached.etag,
              'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600',
              'X-Cache': 'HIT',
            },
            body: '',
          };
          this.metrics.record({ route: req.path, method, status: 304, latencyMs: performance.now() - start, cache: 'HIT' });
          return res;
        }
        const res: ApiResponse = {
          status: 200,
          headers: {
            ...SECURITY_HEADERS,
            ...cors,
            ...rlHeaders,
            ETag: cached.etag,
            'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600',
            'X-Cache': 'HIT',
          },
          body: method === 'HEAD' ? '' : cached.body,
        };
        this.metrics.record({ route: req.path, method, status: 200, latencyMs: performance.now() - start, cache: 'HIT' });
        return res;
      }
    }

    // Route dispatch
    let payload: unknown;
    let status = 200;
    let cacheControl = 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600';

    try {
      if (req.path === '/api/venues') {
        payload = this.queryVenues(req.query);
      } else if (req.path.startsWith('/api/venues/')) {
        const slug = sanitizeTextParam(req.path.slice('/api/venues/'.length), 100);
        const venue = slug ? this.venueBySlug.get(slug) : undefined;
        if (!venue) {
          status = 404;
          payload = { error: 'Casa não encontrada' };
          cacheControl = 'no-store';
        } else {
          const nowMs = Date.now();
          const upcoming = this.events
            .filter((e) => e.venue.id === venue.id && e.event.status === 'published' && e.startMs >= nowMs)
            .map((e) => e.event)
            .slice(0, API_MAX_LIMIT);
          payload = { venue, upcoming, fallbackCover: localFallbackCoverPath(venue.genreSlugs) };
        }
      } else if (req.path === '/api/events') {
        cacheControl = 'public, max-age=30, s-maxage=120, stale-while-revalidate=600';
        payload = this.queryEvents(req.query);
      } else if (req.path.startsWith('/api/events/')) {
        const id = sanitizeTextParam(req.path.slice('/api/events/'.length), 80);
        const event = id ? this.eventById.get(id) : undefined;
        const venue = event ? this.venues.find((v) => v.venue.id === event.venueId)?.venue : undefined;
        if (!event || !venue || event.status === 'draft') {
          status = 404;
          payload = { error: 'Evento não encontrado' };
          cacheControl = 'no-store';
        } else {
          payload = { event, venue, fallbackCover: localFallbackCoverPath(event.genreSlugs) };
        }
      } else {
        status = 404;
        payload = { error: 'Rota não encontrada' };
        cacheControl = 'no-store';
      }
    } catch {
      status = 500;
      payload = { error: 'Erro interno temporário. Tente novamente em instantes.' };
      cacheControl = 'no-store';
    }

    const body = JSON.stringify(payload);
    const routeEtag = computeEtag(body);

    if (status === 200 && !this.disableResponseCache) {
      if (this.responseCache.size > 2000) this.responseCache.clear();
      this.responseCache.set(cacheKey, { body, etag: routeEtag, expiresAt: Date.now() + 60_000 });
    }

    if (status === 200 && inm && inm === routeEtag) {
      const res: ApiResponse = {
        status: 304,
        headers: { ...SECURITY_HEADERS, ...cors, ...rlHeaders, ETag: routeEtag, 'Cache-Control': cacheControl, 'X-Cache': 'MISS' },
        body: '',
      };
      this.metrics.record({ route: req.path, method, status: 304, latencyMs: performance.now() - start, cache: 'MISS' });
      return res;
    }

    const res: ApiResponse = {
      status,
      headers: {
        ...SECURITY_HEADERS,
        ...cors,
        ...rlHeaders,
        ...(status === 200 ? { ETag: routeEtag, 'X-Cache': 'MISS' } : {}),
        'Cache-Control': cacheControl,
      },
      body: method === 'HEAD' ? '' : body,
    };
    this.metrics.record({
      route: req.path,
      method,
      status,
      latencyMs: performance.now() - start,
      cache: status === 200 ? 'MISS' : 'BYPASS',
      ...(status >= 500 ? { error: 'internal_error' } : {}),
    });
    return res;
  }

  private queryVenues(q: Record<string, string | undefined>) {
    const limit = parseIntClamp(q.limit, 1, API_MAX_LIMIT, API_DEFAULT_LIMIT);
    const offset = parseIntClamp(q.cursor ?? q.offset, 0, 10_000, 0);
    const search = sanitizeTextParam(q.q);
    const foldedQ = search ? foldVenueText(search) : null;
    const area = sanitizeTextParam(q.area, 80);
    const foldedArea = area ? foldVenueText(area) : null;
    const genre = sanitizeTextParam(q.genre, 40);
    const priceRange = sanitizeTextParam(q.priceRange, 4);
    const statusFilter = sanitizeTextParam(q.status, 16);
    const lat = clampNumber(q.lat, -90, 90, DEFAULT_LOCATION.lat);
    const lng = clampNumber(q.lng, -180, 180, DEFAULT_LOCATION.lng);
    const radiusKm = q.radiusKm ? clampNumber(q.radiusKm, 0.5, 200, 50) : null;
    const sort = sanitizeTextParam(q.sort, 20) ?? 'name';

    const matches: { card: LeanVenueCard; dist: number }[] = [];
    for (const iv of this.venues) {
      const v = iv.venue;
      if (statusFilter ? v.status !== statusFilter : v.status === 'closed') continue;
      if (foldedArea && iv.foldedArea !== foldedArea) continue;
      if (genre && !v.genreSlugs.includes(genre)) continue;
      if (priceRange && isPriceRange(priceRange) && v.priceRange !== priceRange) continue;
      if (foldedQ && !iv.foldedName.includes(foldedQ) && !iv.foldedArea.includes(foldedQ) && !iv.foldedCity.includes(foldedQ)) continue;
      const dist = Math.round(haversineKm(lat, lng, v.lat, v.lng) * 1000) / 1000;
      if (radiusKm !== null && dist > radiusKm) continue;

      matches.push({
        dist,
        card: {
          id: v.id,
          slug: v.slug,
          name: v.name,
          area: v.area,
          city: v.city,
          uf: v.uf ?? 'ES',
          lat: v.lat,
          lng: v.lng,
          status: v.status,
          genreSlugs: v.genreSlugs,
          priceRange: v.priceRange ?? '$$',
          hours: v.hours,
          coverKey: v.coverKey,
          fallbackCover: iv.fallbackCover,
          distanceKm: dist,
        },
      });
    }

    if (sort === 'distance') matches.sort((a, b) => a.dist - b.dist || a.card.name.localeCompare(b.card.name));
    else matches.sort((a, b) => a.card.name.localeCompare(b.card.name));

    const total = matches.length;
    const items = matches.slice(offset, offset + limit).map((m) => m.card);
    const next = offset + limit;
    return {
      items,
      total,
      limit,
      nextCursor: next < total ? String(next) : null,
    };
  }

  private queryEvents(q: Record<string, string | undefined>) {
    const limit = parseIntClamp(q.limit, 1, API_MAX_LIMIT, API_DEFAULT_LIMIT);
    const offset = parseIntClamp(q.cursor ?? q.offset, 0, 10_000, 0);
    const search = sanitizeTextParam(q.q);
    const foldedQ = search ? foldVenueText(search) : null;
    const area = sanitizeTextParam(q.area, 80);
    const foldedArea = area ? foldVenueText(area) : null;
    const genre = sanitizeTextParam(q.genre, 40);
    const tag = sanitizeTextParam(q.tag, 32);
    const priceMax = q.priceMax !== undefined && q.priceMax !== '' ? clampNumber(q.priceMax, 0, 10_000, 10_000) : null;
    const lat = clampNumber(q.lat, -90, 90, DEFAULT_LOCATION.lat);
    const lng = clampNumber(q.lng, -180, 180, DEFAULT_LOCATION.lng);
    const radiusKm = clampNumber(q.radiusKm, 0.5, 200, 30);
    const sort = sanitizeTextParam(q.sort, 20) ?? 'date';
    const nowMs = q.now && Number.isFinite(Date.parse(q.now)) ? Date.parse(q.now) : Date.parse(this.dataset.generatedAt);

    const matches: { card: LeanEventCard; startMs: number }[] = [];
    for (const ie of this.events) {
      if (ie.event.status !== 'published' || ie.venue.status === 'closed') continue;
      if (ie.startMs < nowMs - 5 * 3_600_000) continue;
      if (foldedArea && foldVenueText(ie.venue.area) !== foldedArea) continue;
      if (genre && !ie.event.genreSlugs.includes(genre)) continue;
      if (tag && !ie.effectiveTags.includes(tag)) continue;
      if (priceMax !== null) {
        if (priceMax === 0) {
          if (!ie.event.isFree) continue;
        } else if (!ie.event.isFree && (ie.event.priceMin == null || ie.event.priceMin > priceMax)) {
          continue;
        }
      }
      if (foldedQ && !ie.foldedSearch.includes(foldedQ)) continue;
      const dist = Math.round(haversineKm(lat, lng, ie.venue.lat, ie.venue.lng) * 1000) / 1000;
      if (dist > radiusKm) continue;

      matches.push({
        startMs: ie.startMs,
        card: {
          id: ie.event.id,
          title: ie.event.title,
          startsAt: ie.event.startsAt,
          priceMin: ie.event.priceMin,
          priceMax: ie.event.priceMax,
          isFree: ie.event.isFree,
          genreSlugs: ie.event.genreSlugs,
          coverKey: ie.event.coverKey,
          fallbackCover: ie.fallbackCover,
          popularity: ie.event.popularity,
          venue: {
            id: ie.venue.id,
            slug: ie.venue.slug,
            name: ie.venue.name,
            area: ie.venue.area,
            city: ie.venue.city,
            lat: ie.venue.lat,
            lng: ie.venue.lng,
          },
          distanceKm: dist,
        },
      });
    }

    matches.sort((a, b) => {
      if (sort === 'distance') return a.card.distanceKm - b.card.distanceKm || a.startMs - b.startMs;
      if (sort === 'popularity') return b.card.popularity - a.card.popularity || a.startMs - b.startMs;
      if (sort === 'price') {
        const pa = a.card.isFree ? 0 : (a.card.priceMin ?? Number.POSITIVE_INFINITY);
        const pb = b.card.isFree ? 0 : (b.card.priceMin ?? Number.POSITIVE_INFINITY);
        return pa - pb || a.startMs - b.startMs;
      }
      return a.startMs - b.startMs || a.card.id.localeCompare(b.card.id);
    });

    const total = matches.length;
    const items = matches.slice(offset, offset + limit).map((m) => m.card);
    const next = offset + limit;
    return {
      items,
      total,
      limit,
      nextCursor: next < total ? String(next) : null,
    };
  }
}

import type {
  Artist,
  ArtistDetail,
  EventDetail,
  EventItem,
  GeoPoint,
  Genre,
  SearchPage,
  SearchParams,
  SeedDataset,
  Venue,
  VenueDetail,
} from '@/domain/types';
import type { Repo } from './repo';
import { SeedRepo } from './seedRepo';

export const FEED_CACHE_KEY = 'qab.feed';
export const FEED_REFRESH_MS = 6 * 60 * 60 * 1000;
/** A feed is rejected when more than this share of its rows is malformed. */
export const FEED_MAX_BAD_RATIO = 0.2;
const FETCH_TIMEOUT_MS = 12_000;
const MAX_FEED_CHARS = 8_000_000;

export type FeedSource = 'feed' | 'cache' | 'seed';

export interface FeedStatus {
  /** ISO time of the last successful check against the feed (200 or 304), or null while on the bundled seed. */
  updatedAt: string | null;
  /** feed = validated from the network this session; cache = persisted copy; seed = bundled dataset. */
  source: FeedSource;
  refreshing: boolean;
}

export interface FeedStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

interface FeedCache {
  dataset: SeedDataset;
  etag: string | null;
  fetchedAt: string;
}

// ---------------------------------------------------------------- validation

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
// Same shape as the SQL check on ticket_url / image_url: https, no userinfo.
const HTTPS_RE = /^https:\/\/[^@/\s]+(\/\S*)?$/i;
const EVENT_STATUS = ['published', 'cancelled', 'draft'];
const VENUE_STATUS = ['open', 'closed', 'unverified'];

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isIso = (v: unknown): v is string => typeof v === 'string' && ISO_RE.test(v) && Number.isFinite(Date.parse(v));
const isStrArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
const optHttps = (v: unknown): boolean => v === undefined || v === null || (typeof v === 'string' && HTTPS_RE.test(v));
const optNum = (v: unknown): boolean => v === undefined || v === null || isNum(v);

const validGenre = (g: unknown): g is Genre => isObj(g) && isStr(g.id) && isStr(g.slug) && isStr(g.label);
const validArtist = (a: unknown): a is Artist =>
  isObj(a) && isStr(a.id) && isStr(a.slug) && isStr(a.name) && isStrArray(a.genreSlugs) && optHttps(a.photoUrl);
const validVenue = (v: unknown): v is Venue =>
  isObj(v) &&
  isStr(v.id) &&
  isStr(v.slug) &&
  isStr(v.name) &&
  isStr(v.area) &&
  isStr(v.city) &&
  isNum(v.lat) &&
  isNum(v.lng) &&
  Math.abs(v.lat) <= 90 &&
  Math.abs(v.lng) <= 180 &&
  VENUE_STATUS.includes(v.status as string) &&
  typeof v.adultOnly === 'boolean' &&
  isStrArray(v.genreSlugs) &&
  isStr(v.coverKey);
const validEvent = (e: unknown, venueIds: Set<string>): e is EventItem =>
  isObj(e) &&
  isStr(e.id) &&
  isStr(e.title) &&
  isStr(e.venueId) &&
  venueIds.has(e.venueId) &&
  isIso(e.startsAt) &&
  (e.endsAt === undefined || e.endsAt === null || isIso(e.endsAt)) &&
  optNum(e.priceMin) &&
  optNum(e.priceMax) &&
  typeof e.isFree === 'boolean' &&
  optHttps(e.ticketUrl) &&
  optHttps(e.imageUrl) &&
  isNum(e.ageMin) &&
  isStrArray(e.genreSlugs) &&
  isStrArray(e.artistIds) &&
  EVENT_STATUS.includes(e.status as string) &&
  isStr(e.coverKey) &&
  isNum(e.popularity);

/**
 * Strict shape check of a feed payload. Bad rows are dropped; the whole feed is rejected (null) when it is not an
 * object, lacks an array, has no usable event, or more than 20% of its rows are bad.
 */
export function validateFeed(raw: unknown): SeedDataset | null {
  if (!isObj(raw)) return null;
  const { genres, venues, artists, events } = raw;
  if (!Array.isArray(genres) || !Array.isArray(venues) || !Array.isArray(artists) || !Array.isArray(events)) return null;
  if (!isIso(raw.generatedAt)) return null;

  const goodGenres = genres.filter(validGenre);
  const goodVenues = venues.filter(validVenue);
  const goodArtists = artists.filter(validArtist);
  const venueIds = new Set(goodVenues.map((v) => v.id));
  const goodEvents = events.filter((e): e is EventItem => validEvent(e, venueIds));

  const total = genres.length + venues.length + artists.length + events.length;
  const good = goodGenres.length + goodVenues.length + goodArtists.length + goodEvents.length;
  if ((total - good) / total > FEED_MAX_BAD_RATIO) return null;
  if (goodEvents.length === 0 || goodVenues.length === 0) return null;
  return { generatedAt: raw.generatedAt, genres: goodGenres, venues: goodVenues, artists: goodArtists, events: goodEvents };
}

// ---------------------------------------------------------------------- repo

export interface FeedRepoOptions {
  /** Bundled dataset: the first-launch and offline fallback. */
  seed: SeedDataset;
  url: string;
  fetchFn?: typeof fetch;
  storage?: FeedStorage;
  clock?: () => number;
  refreshMs?: number;
}

function defaultStorage(): FeedStorage {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@react-native-async-storage/async-storage').default as FeedStorage;
}

/**
 * SeedRepo over a dataset fetched from a static JSON feed. Usable immediately (starts on the bundled seed), then
 * `start()` swaps in the persisted copy and `refresh()` the network one. Subscribers (react-query invalidation,
 * the Perfil row) are told whenever the dataset or the status changes.
 */
export class FeedRepo implements Repo {
  private inner: SeedRepo;
  private dataset: SeedDataset;
  private etag: string | null = null;
  private lastText: string | null = null;
  private fetchedAtMs: number | null = null;
  private inflight: Promise<boolean> | null = null;
  private status: FeedStatus = { updatedAt: null, source: 'seed', refreshing: false };
  /** Bumped whenever the served dataset changes. */
  private version = 0;
  private readonly listeners = new Set<() => void>();
  private readonly fetchFn: typeof fetch;
  private readonly clock: () => number;
  private readonly refreshMs: number;
  private storageRef: FeedStorage | null;

  constructor(private readonly opts: FeedRepoOptions) {
    this.fetchFn = opts.fetchFn ?? ((...a) => fetch(...a));
    this.clock = opts.clock ?? Date.now;
    this.refreshMs = opts.refreshMs ?? FEED_REFRESH_MS;
    this.storageRef = opts.storage ?? null;
    this.dataset = opts.seed;
    this.inner = new SeedRepo(opts.seed, this.clock);
  }

  // --- external store -------------------------------------------------------
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getStatus = (): FeedStatus => this.status;
  getVersion = (): number => this.version;

  private setStatus(patch: Partial<FeedStatus>, dataChanged = false): void {
    this.status = { ...this.status, ...patch };
    if (dataChanged) this.version += 1;
    for (const l of [...this.listeners]) l();
  }

  private storage(): FeedStorage | null {
    if (!this.storageRef) {
      try {
        this.storageRef = defaultStorage();
      } catch {
        return null;
      }
    }
    return this.storageRef;
  }

  private adopt(dataset: SeedDataset): void {
    this.dataset = dataset;
    this.inner = new SeedRepo(dataset, this.clock);
  }

  // --- lifecycle --------------------------------------------------------------
  /** Loads the persisted copy, then refreshes when it is older than the refresh interval. Never throws. */
  async start(): Promise<void> {
    try {
      await this.loadCache();
      if (this.fetchedAtMs == null || this.clock() - this.fetchedAtMs >= this.refreshMs) await this.refresh();
    } catch {
      // Offline-first: any failure leaves the current dataset in place.
    }
  }

  private async loadCache(): Promise<void> {
    const store = this.storage();
    if (!store) return;
    let text: string | null = null;
    try {
      text = await store.getItem(FEED_CACHE_KEY);
    } catch {
      return;
    }
    if (!text) return;
    let cache: FeedCache | null = null;
    try {
      const parsed: unknown = JSON.parse(text);
      if (isObj(parsed) && isIso(parsed.fetchedAt)) {
        const dataset = validateFeed(parsed.dataset);
        if (dataset) cache = { dataset, etag: typeof parsed.etag === 'string' ? parsed.etag : null, fetchedAt: parsed.fetchedAt };
      }
    } catch {
      cache = null;
    }
    if (!cache) {
      store.removeItem(FEED_CACHE_KEY).catch(() => undefined);
      return;
    }
    // A fetch that finished before the cache was read is newer than the cache.
    if (this.status.source === 'feed') return;
    this.adopt(cache.dataset);
    this.etag = cache.etag;
    this.fetchedAtMs = Date.parse(cache.fetchedAt);
    this.setStatus({ updatedAt: cache.fetchedAt, source: 'cache' }, true);
  }

  private async persist(dataset: SeedDataset, fetchedAt: string): Promise<void> {
    const store = this.storage();
    if (!store) return;
    const cache: FeedCache = { dataset, etag: this.etag, fetchedAt };
    try {
      await store.setItem(FEED_CACHE_KEY, JSON.stringify(cache));
    } catch {
      // Cache is best effort.
    }
  }

  /** True when the feed is due for a refresh (never fetched, or older than the interval). */
  isStale(): boolean {
    return this.fetchedAtMs == null || this.clock() - this.fetchedAtMs >= this.refreshMs;
  }

  /**
   * Fetches the feed. Without `force` it is skipped while the last check is younger than 6 h. Resolves true when the
   * served dataset changed. Never throws; failures keep the current dataset.
   */
  refresh(opts: { force?: boolean } = {}): Promise<boolean> {
    if (this.inflight) return this.inflight;
    if (!opts.force && !this.isStale()) return Promise.resolve(false);
    this.setStatus({ refreshing: true });
    this.inflight = this.doRefresh()
      .catch(() => false)
      .then((changed) => {
        this.inflight = null;
        this.setStatus({ refreshing: false });
        return changed;
      });
    return this.inflight;
  }

  private async doRefresh(): Promise<boolean> {
    const url = this.opts.url;
    if (!/^https:\/\//i.test(url) && !(typeof __DEV__ !== 'undefined' && __DEV__)) return false;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS) : null;
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (this.etag && this.status.source !== 'seed') headers['If-None-Match'] = this.etag;
      const res = await this.fetchFn(url, { headers, signal: controller?.signal });
      const nowIso = new Date(this.clock()).toISOString();

      if (res.status === 304 && this.status.source !== 'seed') {
        this.fetchedAtMs = this.clock();
        await this.persist(this.dataset, nowIso);
        this.setStatus({ updatedAt: nowIso, source: 'feed' });
        return false;
      }
      if (!res.ok) return false;

      const text = await res.text();
      if (text.length > MAX_FEED_CHARS) return false;
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        return false;
      }
      const dataset = validateFeed(raw);
      if (!dataset) return false;

      const etag = res.headers?.get?.('etag') ?? null;
      const changed = text !== this.lastText;
      this.etag = etag;
      this.lastText = text;
      this.fetchedAtMs = this.clock();
      if (changed) this.adopt(dataset);
      await this.persist(dataset, nowIso);
      this.setStatus({ updatedAt: nowIso, source: 'feed' }, changed);
      return changed;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  // --- Repo (delegates to the current SeedRepo) -----------------------------------
  listGenres(): Promise<Genre[]> {
    return this.inner.listGenres();
  }
  listAreas(): Promise<string[]> {
    return this.inner.listAreas();
  }
  searchEvents(params: SearchParams): Promise<SearchPage> {
    return this.inner.searchEvents(params);
  }
  getEvent(id: string, from?: GeoPoint): Promise<EventDetail | null> {
    return this.inner.getEvent(id, from);
  }
  getVenue(slug: string): Promise<VenueDetail | null> {
    return this.inner.getVenue(slug);
  }
  getArtist(slug: string, from?: GeoPoint): Promise<ArtistDetail | null> {
    return this.inner.getArtist(slug, from);
  }
  searchArtists(query: string, limit?: number): Promise<Artist[]> {
    return this.inner.searchArtists(query, limit);
  }
}

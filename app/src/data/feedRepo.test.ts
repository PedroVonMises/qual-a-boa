import type { SearchParams, SeedDataset } from '@/domain/types';
import { miniDataset, MINI_NOW } from './__fixtures__/mini';
import { FEED_CACHE_KEY, FeedRepo, validateFeed, type FeedStorage } from './feedRepo';
import { SeedRepo } from './seedRepo';

const URL = 'https://feed.example/feed/v1/events.json';
const T0 = Date.parse(MINI_NOW);
const HOUR = 3_600_000;

const SEED: SeedDataset = {
  ...miniDataset,
  generatedAt: '2026-01-01T00:00:00.000Z',
  events: miniDataset.events.slice(0, 3),
};
const FEED: SeedDataset = { ...miniDataset, generatedAt: '2026-10-23T00:00:00.000Z' };

function memStorage(initial: Record<string, string> = {}): FeedStorage & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: async (k) => (k in data ? data[k] : null),
    setItem: async (k, v) => {
      data[k] = v;
    },
    removeItem: async (k) => {
      delete data[k];
    },
  };
}

function res(status: number, body: unknown, headers: Record<string, string> = {}) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    text: async () => text,
  } as unknown as Response;
}

function setup(responses: (Response | Error)[], storage = memStorage()) {
  let now = T0;
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const queue = [...responses];
  const fetchFn = (async (url: string, init?: { headers?: Record<string, string> }) => {
    calls.push({ url, headers: init?.headers ?? {} });
    const next = queue.shift();
    if (!next) throw new Error('unexpected fetch');
    if (next instanceof Error) throw next;
    return next;
  }) as unknown as typeof fetch;
  const repo = new FeedRepo({ seed: SEED, url: URL, fetchFn, storage, clock: () => now });
  return { repo, calls, storage, advance: (ms: number) => (now += ms) };
}

const base: SearchParams = { lat: -20.3, lng: -40.3, radiusKm: 50, sort: 'date', now: MINI_NOW, limit: 50 };
const count = async (r: FeedRepo) => (await r.searchEvents(base)).total;

describe('FeedRepo', () => {
  it('serves the bundled seed synchronously before any fetch', async () => {
    const { repo, calls } = setup([]);
    expect(repo.getStatus()).toMatchObject({ source: 'seed', updatedAt: null });
    expect(await count(repo)).toBe((await new SeedRepo(SEED).searchEvents(base)).total);
    expect(calls).toHaveLength(0);
  });

  it('200: swaps in the dataset, persists it with the etag and notifies', async () => {
    const { repo, calls, storage } = setup([res(200, FEED, { etag: '"v1"' })]);
    const seen: number[] = [];
    repo.subscribe(() => seen.push(repo.getVersion()));
    expect(await repo.refresh()).toBe(true);
    expect(calls[0].headers['If-None-Match']).toBeUndefined();
    expect(repo.getStatus()).toMatchObject({ source: 'feed', refreshing: false });
    expect(repo.getStatus().updatedAt).toBe(new Date(T0).toISOString());
    expect(await count(repo)).toBeGreaterThan(await count(new FeedRepo({ seed: SEED, url: URL, storage: memStorage() })));
    const saved = JSON.parse(storage.data[FEED_CACHE_KEY]);
    expect(saved.etag).toBe('"v1"');
    expect(saved.dataset.events.length).toBe(FEED.events.length);
    expect(seen.length).toBeGreaterThan(0);
  });

  it('304: sends If-None-Match, keeps data, only bumps the check time', async () => {
    const { repo, calls, advance } = setup([res(200, FEED, { etag: '"v1"' }), res(304, '')]);
    await repo.refresh();
    const version = repo.getVersion();
    advance(7 * HOUR);
    expect(await repo.refresh()).toBe(false);
    expect(calls[1].headers['If-None-Match']).toBe('"v1"');
    expect(repo.getVersion()).toBe(version);
    expect(repo.getStatus().updatedAt).toBe(new Date(T0 + 7 * HOUR).toISOString());
  });

  it('refreshes at most every 6 h unless forced', async () => {
    const { repo, calls, advance } = setup([res(200, FEED), res(200, FEED), res(200, FEED)]);
    await repo.refresh();
    advance(5 * HOUR);
    await repo.refresh();
    expect(calls).toHaveLength(1);
    await repo.refresh({ force: true });
    expect(calls).toHaveLength(2);
    advance(6 * HOUR + 1);
    await repo.refresh();
    expect(calls).toHaveLength(3);
  });

  it('an identical 200 body does not invalidate (no version bump)', async () => {
    const { repo } = setup([res(200, FEED), res(200, FEED)]);
    await repo.refresh();
    const v = repo.getVersion();
    expect(await repo.refresh({ force: true })).toBe(false);
    expect(repo.getVersion()).toBe(v);
  });

  it('network failure keeps the current data and never throws', async () => {
    const { repo } = setup([new Error('offline')]);
    await expect(repo.refresh()).resolves.toBe(false);
    expect(repo.getStatus()).toMatchObject({ source: 'seed', updatedAt: null, refreshing: false });
    expect(await count(repo)).toBe(await count(new FeedRepo({ seed: SEED, url: URL, storage: memStorage() })));
  });

  it('HTTP errors and malformed payloads are rejected', async () => {
    const { repo, storage } = setup([res(500, 'boom'), res(200, '{not json'), res(200, [1, 2]), res(200, { events: [] })]);
    for (let i = 0; i < 4; i++) await repo.refresh({ force: true });
    expect(repo.getStatus().source).toBe('seed');
    expect(storage.data[FEED_CACHE_KEY]).toBeUndefined();
  });

  it('drops a few bad rows but accepts the feed', async () => {
    const bad = {
      ...FEED,
      events: [
        ...FEED.events,
        { ...FEED.events[0], id: 'bad1', startsAt: 'amanhã' },
        { ...FEED.events[0], id: 'bad2', ticketUrl: 'http://x.example/t' },
      ],
    };
    const { repo } = setup([res(200, bad)]);
    await repo.refresh();
    expect(repo.getStatus().source).toBe('feed');
    expect(await repo.getEvent('bad1')).toBeNull();
    expect(await repo.getEvent('bad2')).toBeNull();
    expect(await repo.getEvent('e01')).not.toBeNull();
  });

  it('rejects the whole feed when more than 20% of rows are bad', async () => {
    const half = { ...FEED, events: FEED.events.map((e, i) => (i % 2 ? { ...e, imageUrl: 'http://x.example/i.jpg' } : e)) };
    const { repo } = setup([res(200, half)]);
    await repo.refresh();
    expect(repo.getStatus().source).toBe('seed');
  });

  it('offline first launch falls back to the seed; start() reuses a fresh cache without fetching', async () => {
    const off = setup([new Error('offline')]);
    await off.repo.start();
    expect(off.repo.getStatus().source).toBe('seed');

    const online = setup([res(200, FEED, { etag: '"v1"' })]);
    await online.repo.start();
    const cached = { ...online.storage.data };

    const { repo, calls } = setup([], memStorage(cached));
    await repo.start();
    expect(calls).toHaveLength(0);
    expect(repo.getStatus()).toMatchObject({ source: 'cache' });
    expect(await count(repo)).toBe(await count(online.repo));
  });

  it('a stale cache is served first, then revalidated with its etag', async () => {
    const first = setup([res(200, FEED, { etag: '"v1"' })]);
    await first.repo.start();
    const second = setup([res(304, '')], memStorage({ ...first.storage.data }));
    second.advance(7 * HOUR);
    await second.repo.start();
    expect(second.calls[0].headers['If-None-Match']).toBe('"v1"');
    expect(second.repo.getStatus().source).toBe('feed');
    expect(await count(second.repo)).toBe(await count(first.repo));
  });

  it('a corrupted cache is discarded', async () => {
    const storage = memStorage({ [FEED_CACHE_KEY]: '{"dataset":{"events":1},"fetchedAt":"x"}' });
    const { repo } = setup([new Error('offline')], storage);
    await repo.start();
    expect(repo.getStatus().source).toBe('seed');
    expect(storage.data[FEED_CACHE_KEY]).toBeUndefined();
  });
});

describe('validateFeed', () => {
  it('rejects non-objects, missing arrays and unusable feeds', () => {
    for (const v of [null, 'x', 3, [], {}, { ...FEED, venues: undefined }, { ...FEED, generatedAt: 'ontem' }, { ...FEED, events: [] }]) {
      expect(validateFeed(v)).toBeNull();
    }
  });
  it('drops events with an unknown venue, non-ISO dates or non-https urls', () => {
    const ev = FEED.events[0];
    const out = validateFeed({
      ...FEED,
      events: [
        ...FEED.events,
        { ...ev, id: 'x1', venueId: 'nope' },
        { ...ev, id: 'x2', endsAt: '2026-10-24' },
        { ...ev, id: 'x3', imageUrl: 'javascript:alert(1)' },
        { ...ev, id: 'x4', ticketUrl: 'https://u@evil.example/' },
      ],
    })!;
    expect(out.events.map((e) => e.id)).toEqual(FEED.events.map((e) => e.id));
  });
  it('accepts the https image of a valid event', () => {
    const out = validateFeed({ ...FEED, events: [{ ...FEED.events[0], imageUrl: 'https://img.example/p.jpg' }] })!;
    expect(out.events[0].imageUrl).toBe('https://img.example/p.jpg');
  });
});

describe('FeedRepo / SeedRepo contract', () => {
  const clock = () => T0;
  const cases: { name: string; params: Partial<SearchParams> }[] = [
    { name: 'default', params: {} },
    { name: 'price sort', params: { sort: 'price' } },
    { name: 'popularity', params: { sort: 'popularity' } },
    { name: 'distance', params: { sort: 'distance', radiusKm: 6 } },
    { name: 'free only', params: { priceMax: 0 } },
    { name: 'genre', params: { genreSlugs: ['funk'] } },
    { name: 'area', params: { area: 'Praia do Canto' } },
    { name: 'accent-insensitive query', params: { query: 'eletronica techno' } },
    { name: 'artist query', params: { query: 'agata' } },
    { name: 'paging', params: { limit: 2, cursor: '2' } },
    { name: 'nothing', params: { query: 'zzzz' } },
  ];

  it('returns identical results for the same dataset', async () => {
    const seedRepo = new SeedRepo(miniDataset, clock);
    const feed = new FeedRepo({ seed: SEED, url: URL, clock, storage: memStorage(), fetchFn: (async () => res(200, miniDataset)) as unknown as typeof fetch });
    await feed.refresh();
    for (const c of cases) {
      const p = { ...base, ...c.params };
      expect(await feed.searchEvents(p)).toEqual(await seedRepo.searchEvents(p));
    }
    expect(await feed.listGenres()).toEqual(await seedRepo.listGenres());
    expect(await feed.listAreas()).toEqual(await seedRepo.listAreas());
    expect(await feed.getEvent('e01', { lat: -20.3, lng: -40.3, label: 'x' })).toEqual(await seedRepo.getEvent('e01', { lat: -20.3, lng: -40.3, label: 'x' }));
    expect(await feed.getVenue('bolt')).toEqual(await seedRepo.getVenue('bolt'));
    expect(await feed.getArtist('mc-maré')).toEqual(await seedRepo.getArtist('mc-maré'));
    expect(await feed.searchArtists('dj')).toEqual(await seedRepo.searchArtists('dj'));
  });
});

describe('validateFeed tags', () => {
  it('keeps known tags and drops unknown ones without rejecting the row', () => {
    const feed = {
      ...miniDataset,
      venues: miniDataset.venues.map((v) => (v.id === 'v1' ? { ...v, accessTags: ['vegano', 'nope'] } : v)),
    };
    const out = validateFeed(feed);
    expect(out).not.toBeNull();
    expect(out!.venues.find((v) => v.id === 'v1')!.accessTags).toEqual(['vegano']);
    expect(out!.venues.find((v) => v.id === 'v3')!.accessTags).toBeUndefined();
  });
});

import { DEFAULT_LOCATION, type SearchParams } from '@/domain/types';
import { miniDataset, MINI_NOW } from './__fixtures__/mini';
import { normalizeText, SeedRepo } from './seedRepo';

const repo = new SeedRepo(miniDataset, () => Date.parse(MINI_NOW));
const base: SearchParams = {
  lat: DEFAULT_LOCATION.lat,
  lng: DEFAULT_LOCATION.lng,
  radiusKm: 25,
  sort: 'date',
  now: MINI_NOW,
};
const ids = async (p: Partial<SearchParams>) => (await repo.searchEvents({ ...base, ...p })).items.map((i) => i.event.id);

describe('normalizeText', () => {
  it('lowercases and strips accents', () => {
    expect(normalizeText('Eletrônica Ágata')).toBe('eletronica agata');
  });
});

describe('SeedRepo.searchEvents', () => {
  it('excludes past, cancelled, draft and closed-venue events', async () => {
    const got = await ids({});
    expect(got).toEqual(expect.arrayContaining(['e01', 'e02', 'e03', 'e04', 'e05', 'e06']));
    for (const bad of ['e07', 'e08', 'e09', 'e10', 'e11', 'e12']) expect(got).not.toContain(bad);
  });

  it('sorts by date and breaks ties deterministically', async () => {
    const got = await ids({ sort: 'date' });
    expect(got).toEqual(['e01', 'e02', 'e03', 'e04', 'e05', 'e06']);
  });

  it('sorts by distance ascending', async () => {
    const res = await repo.searchEvents({ ...base, sort: 'distance' });
    const d = res.items.map((i) => i.distanceKm);
    expect([...d].sort((a, b) => a - b)).toEqual(d);
  });

  it('sorts by price with free first and unknown last', async () => {
    const got = await ids({ sort: 'price' });
    expect(got[0]).toBe('e02');
    expect(got[got.length - 1]).toBe('e06');
  });

  it('sorts by popularity descending', async () => {
    const got = await ids({ sort: 'popularity' });
    expect(got[0]).toBe('e01');
  });

  it('filters by radius', async () => {
    const got = await ids({ radiusKm: 1 });
    expect(got.sort()).toEqual(['e01', 'e04', 'e06']);
  });

  it('filters by genre', async () => {
    expect((await ids({ genreSlugs: ['rock'] }))).toEqual(['e03']);
  });

  it('priceMax 0 means only free', async () => {
    expect(await ids({ priceMax: 0 })).toEqual(['e02']);
  });

  it('priceMax keeps free events and drops unknown prices', async () => {
    const got = await ids({ priceMax: 30 });
    expect(got).toEqual(['e01', 'e02', 'e03', 'e05']);
  });

  it('filters by date window', async () => {
    const got = await ids({ dateFrom: '2026-10-25T00:00:00.000Z', dateTo: '2026-10-26T00:00:00.000Z' });
    expect(got).toEqual(['e03', 'e04']);
  });

  it('filters by artist', async () => {
    expect(await ids({ artistId: 'a6' })).toEqual(['e01', 'e04']);
  });

  it('filters by area, accent-insensitive', async () => {
    expect(await ids({ area: 'jardim da penha' })).toEqual(['e02', 'e05']);
  });

  it('matches query against title, venue and artist, accent-insensitive', async () => {
    expect(await ids({ query: 'agata' })).toEqual(['e04']);
    expect(await ids({ query: 'selva' })).toEqual(['e02', 'e05']);
    expect(await ids({ query: 'FUNK' })).toEqual(['e01']);
  });

  it('paginates with cursor and reports total', async () => {
    const p1 = await repo.searchEvents({ ...base, limit: 4 });
    expect(p1.items).toHaveLength(4);
    expect(p1.total).toBe(6);
    expect(p1.nextCursor).toBe('4');
    const p2 = await repo.searchEvents({ ...base, limit: 4, cursor: p1.nextCursor });
    expect(p2.items).toHaveLength(2);
    expect(p2.nextCursor).toBeNull();
  });
});

describe('SeedRepo details', () => {
  it('getEvent returns lineup in billing order and null for drafts', async () => {
    const d = await repo.getEvent('e01', DEFAULT_LOCATION);
    expect(d?.lineup.map((a) => a.id)).toEqual(['a1', 'a6']);
    expect(d?.distanceKm).not.toBeNull();
    expect(await repo.getEvent('e09')).toBeNull();
    expect((await repo.getEvent('e01'))?.distanceKm).toBeNull();
  });

  it('getVenue lists upcoming and past artists with counts', async () => {
    const v = await repo.getVenue('bolt');
    expect(v?.upcoming.map((e) => e.id)).toEqual(['e01', 'e04', 'e06']);
    const mc = v?.pastArtists.find((p) => p.artist.id === 'a1');
    expect(mc?.times).toBe(2);
    expect(mc?.lastPlayedAt).toBe('2026-10-10T02:00:00.000Z');
    expect(v?.pastArtists[0].artist.id).toBe('a1');
    expect(await repo.getVenue('nope')).toBeNull();
  });

  it('getArtist returns upcoming gigs and venues played', async () => {
    const a = await repo.getArtist('mc-maré', DEFAULT_LOCATION);
    expect(a?.upcoming.map((i) => i.event.id)).toEqual(['e01', 'e06']);
    expect(a?.playedAt.map((p) => p.venue.id)).toEqual(['v1', 'v2']);
  });

  it('searchArtists matches without accents and honors limit', async () => {
    expect((await repo.searchArtists('mare')).map((a) => a.id)).toEqual(['a1']);
    expect(await repo.searchArtists('dj', 1)).toHaveLength(1);
    expect(await repo.searchArtists('  ')).toEqual([]);
  });

  it('listAreas omits areas with only closed venues', async () => {
    expect(await repo.listAreas()).toEqual(['Jardim da Penha', 'Praia do Canto', 'Vila Velha']);
  });
});

describe('SeedRepo tags', () => {
  const ds = {
    ...miniDataset,
    venues: miniDataset.venues.map((v) => (v.id === 'v1' ? { ...v, accessTags: ['acessivel' as const] } : { ...v, accessTags: undefined })),
    events: miniDataset.events.map((e) => (e.id === 'e02' ? { ...e, accessTags: ['vegano' as const] } : e)),
  };
  const tagRepo = new SeedRepo(ds, () => Date.parse(MINI_NOW));
  const tagBase: SearchParams = { ...base, radiusKm: 50, limit: 100 };

  it('matches venue tags and event tags, ANDed', async () => {
    const venueTag = await tagRepo.searchEvents({ ...tagBase, tags: ['acessivel'] });
    expect(venueTag.items.length).toBeGreaterThan(0);
    expect(venueTag.items.every((i) => i.venue.id === 'v1')).toBe(true);
    const eventTag = await tagRepo.searchEvents({ ...tagBase, tags: ['vegano'] });
    expect(eventTag.items.map((i) => i.event.id)).toEqual(['e02']);
    const both = await tagRepo.searchEvents({ ...tagBase, tags: ['acessivel', 'vegano'] });
    expect(both.items).toEqual([]);
  });
});

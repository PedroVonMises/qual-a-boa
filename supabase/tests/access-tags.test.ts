import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { DEFAULT_LOCATION } from '../../app/src/domain/types';
import type { SearchParams, SeedDataset } from '../../app/src/domain/types';
import { createDb, FIXED_NOW, search, type DB } from './harness';

const base: SearchParams = {
  lat: DEFAULT_LOCATION.lat, lng: DEFAULT_LOCATION.lng, radiusKm: 30, sort: 'date', limit: 100, now: FIXED_NOW,
};

const ds: SeedDataset = {
  generatedAt: FIXED_NOW,
  genres: [{ id: '00000000-0000-4000-8000-0000000000a1', slug: 'funk', label: 'Funk' }],
  venues: [
    { id: '00000000-0000-4000-8000-0000000000b1', slug: 'v-a', name: 'A', area: 'Centro', city: 'Vitória', lat: DEFAULT_LOCATION.lat, lng: DEFAULT_LOCATION.lng,
      status: 'open', adultOnly: true, genreSlugs: ['funk'], coverKey: 'generic', placeholder: true, accessTags: ['acessivel'] },
    { id: '00000000-0000-4000-8000-0000000000b2', slug: 'v-b', name: 'B', area: 'Centro', city: 'Vitória', lat: DEFAULT_LOCATION.lat, lng: DEFAULT_LOCATION.lng,
      status: 'open', adultOnly: true, genreSlugs: ['funk'], coverKey: 'generic', placeholder: true },
  ],
  artists: [],
  events: [
    { id: '00000000-0000-4000-8000-0000000000c1', title: 'Só venue acessível', venueId: '00000000-0000-4000-8000-0000000000b1', startsAt: '2026-10-24T02:00:00.000Z',
      priceMin: 10, priceMax: 10, isFree: false, ageMin: 18, genreSlugs: ['funk'], artistIds: [], status: 'published', coverKey: 'generic', popularity: 10 },
    { id: '00000000-0000-4000-8000-0000000000c2', title: 'Venue acessível + evento vegano', venueId: '00000000-0000-4000-8000-0000000000b1', startsAt: '2026-10-24T03:00:00.000Z',
      priceMin: 10, priceMax: 10, isFree: false, ageMin: 18, genreSlugs: ['funk'], artistIds: [], status: 'published', coverKey: 'generic', popularity: 10, accessTags: ['acessivel', 'vegano'] },
    { id: '00000000-0000-4000-8000-0000000000c3', title: 'Noite pet no venue sem tags', venueId: '00000000-0000-4000-8000-0000000000b2', startsAt: '2026-10-24T04:00:00.000Z',
      priceMin: 10, priceMax: 10, isFree: false, ageMin: 18, genreSlugs: ['funk'], artistIds: [], status: 'published', coverKey: 'generic', popularity: 10, accessTags: ['pet-friendly'] },
  ],
};
const [c1, c2, c3] = ds.events.map((e) => e.id);

let db: DB;
before(async () => { db = await createDb(ds); });
after(async () => { await db.close(); });

describe('access tags', () => {
  test('no tags param returns everything', async () => {
    const r = await search(db, base);
    assert.deepEqual(r.ids, [c1, c2, c3]);
  });

  test('venue tags apply to the venue\'s events', async () => {
    const r = await search(db, { ...base, tags: ['acessivel'] });
    assert.deepEqual(r.ids, [c1, c2]);
  });

  test('event tags apply to that event only', async () => {
    const r = await search(db, { ...base, tags: ['pet-friendly'] });
    assert.deepEqual(r.ids, [c3]);
  });

  test('multiple tags are ANDed over the union of venue and event tags', async () => {
    const r = await search(db, { ...base, tags: ['acessivel', 'vegano'] });
    assert.deepEqual(r.ids, [c2]);
    const none = await search(db, { ...base, tags: ['acessivel', 'pet-friendly'] });
    assert.deepEqual(none.ids, []);
  });

  test('empty tags array means no filter', async () => {
    const r = await search(db, { ...base, tags: [] });
    assert.equal(r.total, 3);
  });

  test('rows return the effective, ordered, de-duplicated tag set', async () => {
    const r = await search(db, base);
    const by = Object.fromEntries(r.rows.map((x) => [x.id, x.access_tags]));
    assert.deepEqual(by[c1], ['acessivel']);
    assert.deepEqual(by[c2], ['acessivel', 'vegano']);
    assert.deepEqual(by[c3], ['pet-friendly']);
  });

  test('CHECK rejects unknown slugs on venues and events', async () => {
    await assert.rejects(db.query(`update public.venues set access_tags = array['nope'] where slug = 'v-a'`), /access_tags/);
    await assert.rejects(db.query(`update public.events set access_tags = array['nope'] where title = 'Só venue acessível'`), /access_tags/);
  });
});

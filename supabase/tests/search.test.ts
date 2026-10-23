import assert from 'node:assert/strict';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';

import type { SearchParams, SeedDataset } from '../../app/src/domain/types';
import { DEFAULT_LOCATION } from '../../app/src/domain/types';
import { artistId, buildSeed } from '../seed/seed-data';
import { createDb, FIXED_NOW, FIXTURES_DIR, readJson, search, type DB } from './harness';
import { fold, haversineKm, referenceSearch } from './reference';

interface SearchCase {
  name: string;
  params: SearchParams;
  expectedEventIds: string[];
  expectedTotal: number;
}

const ds: SeedDataset = buildSeed(new Date(FIXED_NOW));
const events = new Map(ds.events.map((e) => [e.id, e]));
const venues = new Map(ds.venues.map((v) => [v.id, v]));
const base: SearchParams = {
  lat: DEFAULT_LOCATION.lat, lng: DEFAULT_LOCATION.lng, radiusKm: 30, sort: 'date', limit: 100, now: FIXED_NOW,
};
const ev = (id: string) => events.get(id)!;
const venueOf = (id: string) => venues.get(ev(id).venueId)!;

let db: DB;
before(async () => { db = await createDb(ds); });
after(async () => { await db.close(); });

describe('haversine_km and fold_text', () => {
  test('haversine matches the JS formula and is 0 for the same point', async () => {
    const r = await db.query<{ d: number; z: number }>(
      `select public.haversine_km(-20.2976, -40.2958, -20.3640, -40.2830) as d,
              public.haversine_km(1, 2, 1, 2) as z`);
    assert.ok(Math.abs(r.rows[0].d - haversineKm(-20.2976, -40.2958, -20.364, -40.283)) < 1e-9);
    assert.equal(r.rows[0].z, 0);
  });
  test('fold_text strips accents and lower-cases like NFD folding', async () => {
    const s = 'Ação MARÉ Pagodão Forró Atômica Ñandú ÿ';
    const r = await db.query<{ f: string }>(`select public.fold_text($1) as f`, [s]);
    assert.equal(r.rows[0].f, fold(s));
  });
});

describe('search_events semantics', () => {
  test('1. only published, upcoming (>= now), venue not closed', async () => {
    const r = await search(db, base);
    assert.ok(r.total > 30);
    for (const id of r.ids) {
      assert.equal(ev(id).status, 'published');
      assert.ok(Date.parse(ev(id).startsAt) >= Date.parse(FIXED_NOW));
      assert.notEqual(venueOf(id).status, 'closed');
    }
    const hidden = ds.events.filter((e) => e.status !== 'published' && Date.parse(e.startsAt) > Date.parse(FIXED_NOW));
    assert.ok(hidden.length >= 2, 'seed has upcoming draft/cancelled events');
    for (const e of hidden) assert.ok(!r.ids.includes(e.id));
    // Unverified venues are included.
    assert.ok(r.ids.some((id) => venueOf(id).status === 'unverified'));
  });

  test('1b. events at closed venues are excluded even when dateFrom reaches the past', async () => {
    const r = await search(db, { ...base, dateFrom: '2026-01-01T00:00:00Z' });
    assert.ok(r.ids.every((id) => venueOf(id).slug !== 'casa-caipora'));
    assert.ok(r.ids.some((id) => Date.parse(ev(id).startsAt) < Date.parse(FIXED_NOW)), 'dateFrom overrides now');
  });

  test('2. radius is inclusive and distance_km is rounded to 3 decimals', async () => {
    const r = await search(db, { ...base, sort: 'distance' });
    for (const row of r.rows) {
      assert.equal(row.distance_km, Math.round(row.distance_km * 1000) / 1000);
    }
    const bolt = r.rows.find((x) => x.venue_name === 'Bolt')!;
    const exact = haversineKm(base.lat, base.lng, venueOf(bolt.id).lat, venueOf(bolt.id).lng);
    const inclusive = await search(db, { ...base, radiusKm: exact });
    assert.ok(inclusive.ids.includes(bolt.id), 'distance == radius is included');
    const justBelow = await search(db, { ...base, radiusKm: exact - 1e-6 });
    assert.ok(!justBelow.ids.includes(bolt.id));
    const none = await search(db, { ...base, radiusKm: 0 });
    assert.equal(none.total, 0);
  });

  test('3. genres match with OR', async () => {
    const a = await search(db, { ...base, genreSlugs: ['funk'] });
    const b = await search(db, { ...base, genreSlugs: ['metal-punk-goth'] });
    const ab = await search(db, { ...base, genreSlugs: ['funk', 'metal-punk-goth'] });
    assert.deepEqual(new Set(ab.ids), new Set([...a.ids, ...b.ids]));
    for (const id of a.ids) assert.ok(ev(id).genreSlugs.includes('funk'));
    const empty = await search(db, { ...base, genreSlugs: [] });
    assert.equal(empty.total, (await search(db, base)).total);
  });

  test('4. price: 0 = only free; >0 = free or price_min <= max; null price excluded', async () => {
    const free = await search(db, { ...base, priceMax: 0 });
    assert.ok(free.total > 0);
    for (const id of free.ids) assert.equal(ev(id).isFree, true);
    const upTo20 = await search(db, { ...base, priceMax: 20 });
    for (const id of upTo20.ids) assert.ok(ev(id).isFree || (ev(id).priceMin !== null && ev(id).priceMin! <= 20));
    assert.ok(upTo20.ids.some((id) => !ev(id).isFree), 'paid events within budget included');
    const nullPrice = ds.events.find((e) => e.priceMin === null && !e.isFree && e.status === 'published')!;
    assert.ok(nullPrice);
    assert.ok((await search(db, base)).ids.includes(nullPrice.id));
    assert.ok(!(await search(db, { ...base, priceMax: 1000 })).ids.includes(nullPrice.id));
  });

  test('5. date range is inclusive on both ends', async () => {
    const all = await search(db, base);
    const target = ev(all.ids[3]);
    const r = await search(db, { ...base, dateFrom: target.startsAt, dateTo: target.startsAt });
    assert.ok(r.ids.includes(target.id));
    for (const id of r.ids) assert.equal(ev(id).startsAt, target.startsAt);
    const to = new Date(Date.parse(FIXED_NOW) + 7 * 86_400_000).toISOString();
    const week = await search(db, { ...base, dateTo: to });
    for (const id of week.ids) assert.ok(ev(id).startsAt <= to);
    assert.ok(week.total < all.total);
  });

  test('6. artist filter', async () => {
    const id = artistId('dj-caju');
    const r = await search(db, { ...base, artistId: id });
    assert.ok(r.total > 0);
    for (const e of r.ids) assert.ok(ev(e).artistIds.includes(id));
  });

  test('7. area equals, case-insensitive', async () => {
    const r = await search(db, { ...base, area: 'PRAIA DO CANTO' });
    assert.ok(r.total > 0);
    for (const id of r.ids) assert.equal(venueOf(id).area, 'Praia do Canto');
    const vv = await search(db, { ...base, area: 'vila velha' });
    assert.ok(vv.total > 0);
    assert.equal((await search(db, { ...base, area: 'Praia' })).total, 0, 'not a substring match');
  });

  test('8. query: accent/case-insensitive over title, venue name and lineup', async () => {
    const title = await search(db, { ...base, query: 'PAGODAO' });
    assert.ok(title.total > 0);
    for (const id of title.ids) assert.match(fold(ev(id).title), /pagodao/);
    const venue = await search(db, { ...base, query: 'casa mare' });
    assert.ok(venue.total > 0);
    for (const id of venue.ids) assert.equal(venueOf(id).slug, 'casa-mare');
    const artist = await search(db, { ...base, query: 'noctâmbulos' });
    assert.ok(artist.total > 0);
    for (const id of artist.ids) assert.ok(ev(id).artistIds.includes(artistId('os-noctambulos')));
    assert.equal((await search(db, { ...base, query: '   ' })).total, (await search(db, base)).total);
    assert.equal((await search(db, { ...base, query: '%' })).total, 0, 'no LIKE wildcards');
  });

  test('9. sorts and tie-breaks', async () => {
    const byDist = await search(db, { ...base, sort: 'distance' });
    for (let i = 1; i < byDist.rows.length; i++) {
      const a = byDist.rows[i - 1], b = byDist.rows[i];
      assert.ok(a.distance_km <= b.distance_km);
      if (a.distance_km === b.distance_km) assert.ok(a.starts_at <= b.starts_at);
    }
    const byPrice = await search(db, { ...base, sort: 'price' });
    const keys = byPrice.ids.map((id) => (ev(id).isFree ? 0 : ev(id).priceMin));
    const lastNonNull = keys.findLastIndex((k) => k !== null);
    assert.ok(keys.slice(lastNonNull + 1).every((k) => k === null), 'null prices last');
    assert.equal(keys.at(-1), null);
    for (let i = 1; i <= lastNonNull; i++) assert.ok((keys[i - 1] as number) <= (keys[i] as number));
    const byPop = await search(db, { ...base, sort: 'popularity' });
    for (let i = 1; i < byPop.ids.length; i++) {
      const a = ev(byPop.ids[i - 1]), b = ev(byPop.ids[i]);
      assert.ok(a.popularity >= b.popularity);
      if (a.popularity === b.popularity) {
        assert.ok(a.startsAt < b.startsAt || (a.startsAt === b.startsAt && a.id < b.id));
      }
    }
    const byDate = await search(db, base);
    for (let i = 1; i < byDate.ids.length; i++) {
      const a = ev(byDate.ids[i - 1]), b = ev(byDate.ids[i]);
      assert.ok(a.startsAt < b.startsAt || (a.startsAt === b.startsAt && a.id < b.id));
    }
  });

  test('10. pagination with total_count before pagination', async () => {
    const all = await search(db, base);
    const p1 = await search(db, { ...base, limit: 7 });
    const p2 = await search(db, { ...base, limit: 7, cursor: '7' });
    assert.deepEqual([...p1.ids, ...p2.ids], all.ids.slice(0, 14));
    assert.equal(p1.total, all.total);
    assert.equal(p2.total, all.total);
    const def = await search(db, { ...base, limit: undefined });
    assert.equal(def.ids.length, 20, 'default limit 20');
    const end = await search(db, { ...base, cursor: String(all.total) });
    assert.equal(end.ids.length, 0);
  });

  test('result rows carry venue summary, genres and lineup in billing order', async () => {
    const r = await search(db, { ...base, limit: 100 });
    for (const row of r.rows) {
      const e = ev(row.id);
      assert.deepEqual(row.genre_slugs, e.genreSlugs);
      assert.deepEqual(row.artist_ids, e.artistIds);
      assert.equal(row.venue_name, venueOf(row.id).name);
      assert.equal(row.total_count, r.total);
    }
  });
});

describe('fixtures (shared with the TypeScript SeedRepo)', () => {
  const cases = readJson<SearchCase[]>(path.join(FIXTURES_DIR, 'search-cases.json'));
  const fixed = readJson<SeedDataset>(path.join(FIXTURES_DIR, 'seed-fixed.json'));

  test('seed-fixed.json equals buildSeed(FIXED_NOW)', () => {
    assert.deepEqual(fixed, JSON.parse(JSON.stringify(ds)));
  });

  for (const c of cases) {
    test(`case: ${c.name}`, async () => {
      const r = await search(db, c.params);
      assert.deepEqual(r.ids, c.expectedEventIds);
      assert.equal(r.total, c.expectedTotal);
      const ref = referenceSearch(ds, c.params);
      assert.deepEqual(ref.ids, c.expectedEventIds, 'reference TS implementation agrees');
      assert.equal(ref.total, c.expectedTotal);
    });
  }
});

describe('SQL vs reference implementation, randomized', () => {
  test('300 random parameter sets agree', async () => {
    let seed = 42;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const pick = <T>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
    const genreSlugs = ds.genres.map((g) => g.slug);
    const sorts = ['distance', 'price', 'date', 'popularity'] as const;
    for (let i = 0; i < 300; i++) {
      const p: SearchParams = {
        lat: -20.33 + rnd() * 0.08,
        lng: -40.34 + rnd() * 0.07,
        radiusKm: pick([0.5, 1, 2, 3, 5, 8, 15, 50]),
        sort: pick([...sorts]),
        limit: pick([5, 10, 20, 50]),
        cursor: pick([null, '0', '5', '10']),
        now: FIXED_NOW,
      };
      if (rnd() < 0.4) p.genreSlugs = [pick(genreSlugs), pick(genreSlugs)];
      if (rnd() < 0.4) p.priceMax = pick([0, 15, 20, 30, 45, 60]);
      if (rnd() < 0.3) p.dateTo = new Date(Date.parse(FIXED_NOW) + pick([2, 7, 14]) * 86_400_000).toISOString();
      if (rnd() < 0.15) p.dateFrom = new Date(Date.parse(FIXED_NOW) + pick([-30, 3, 10]) * 86_400_000).toISOString();
      if (rnd() < 0.2) p.artistId = pick(ds.artists).id;
      if (rnd() < 0.2) p.area = pick(['centro', 'Praia do Canto', 'JARDIM DA PENHA', 'Vila Velha', 'Camburi']);
      if (rnd() < 0.2) p.query = pick(['dj', 'Maré', 'samba', 'bolt', 'NEON', 'atomica', 'selva', 'x']);
      const sql = await search(db, p);
      const ref = referenceSearch(ds, p);
      assert.deepEqual(sql.ids, ref.ids, JSON.stringify(p));
      if (sql.ids.length) assert.equal(sql.total, ref.total, JSON.stringify(p));
    }
  });
});

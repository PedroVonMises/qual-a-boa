import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import type { SeedDataset } from '../../app/src/domain/types';
import { DEFAULT_LOCATION } from '../../app/src/domain/types';
import { buildSeed } from '../seed/seed-data';
import { createDb, FIXED_NOW, search, type DB } from './harness';

const ds: SeedDataset = buildSeed(new Date(FIXED_NOW));
let db: DB;
before(async () => { db = await createDb(ds); });
after(async () => { await db.close(); });

describe('0015 performance indexes and search_events hardening', () => {
  test('all composite, partial, and GIN indexes exist in pg_indexes', async () => {
    const r = await db.query<{ indexname: string }>(
      `select indexname from pg_indexes where schemaname = 'public'`,
    );
    const names = new Set(r.rows.map((x) => x.indexname));
    for (const expected of [
      'venues_open_area_idx',
      'venues_open_lat_lng_idx',
      'venues_uf_status_area_idx',
      'venues_access_tags_gin_idx',
      'venues_genre_slugs_gin_idx',
      'events_published_starts_id_idx',
      'events_published_venue_starts_idx',
      'events_published_pop_idx',
      'events_published_price_idx',
      'events_access_tags_gin_idx',
      'artists_fold_name_idx',
    ]) {
      assert.ok(names.has(expected), `missing expected performance index: ${expected}`);
    }
  });

  test('search_events enforces hard p_limit ceiling (<= 500) and handles negative/oversized inputs safely', async () => {
    const huge = await search(db, {
      lat: DEFAULT_LOCATION.lat,
      lng: DEFAULT_LOCATION.lng,
      radiusKm: 50,
      sort: 'date',
      limit: 999_999,
      now: FIXED_NOW,
    });
    assert.ok(huge.ids.length <= 500);
    assert.ok(huge.total > 200);

    const neg = await search(db, {
      lat: DEFAULT_LOCATION.lat,
      lng: DEFAULT_LOCATION.lng,
      radiusKm: 50,
      sort: 'date',
      limit: -5,
      cursor: '-10',
      now: FIXED_NOW,
    });
    assert.equal(neg.ids.length, 0);

    const longQuery = await search(db, {
      lat: DEFAULT_LOCATION.lat,
      lng: DEFAULT_LOCATION.lng,
      radiusKm: 50,
      sort: 'date',
      query: 'a'.repeat(500),
      now: FIXED_NOW,
    });
    assert.equal(longQuery.ids.length, 0);
  });

  test('EXPLAIN succeeds on filtered search_events with 220+ venues', async () => {
    const plan = await db.query<{ 'QUERY PLAN': string }>(
      `explain select * from public.search_events($1, $2, $3, $4, $5, null, null, null, $6, null, 'popularity', 20, 0, $7, null)`,
      [DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng, 10, ['funk', 'pop-hits'], 40, 'Praia do Canto', FIXED_NOW],
    );
    assert.ok(plan.rows.length > 0);
  });
});

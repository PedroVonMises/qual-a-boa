import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import type { SeedDataset } from '../../app/src/domain/types';
import { artistId, buildSeed, venueId } from '../seed/seed-data';
import { asRole, createDb, FIXED_NOW, type DB } from './harness';

const ds: SeedDataset = buildSeed(new Date(FIXED_NOW));
const now = Date.parse(FIXED_NOW);

/** Expected history computed straight from the dataset. */
function expectedPastArtists(vId: string) {
  const m = new Map<string, { last: string; times: number }>();
  for (const e of ds.events) {
    if (e.venueId !== vId || e.status !== 'published' || Date.parse(e.startsAt) >= now) continue;
    for (const a of e.artistIds) {
      const cur = m.get(a);
      if (!cur) m.set(a, { last: e.startsAt, times: 1 });
      else m.set(a, { last: e.startsAt > cur.last ? e.startsAt : cur.last, times: cur.times + 1 });
    }
  }
  return m;
}

interface PastArtistRow { artist_id: string; artist_name: string; last_played_at: Date; times: number }
interface PlayedAtRow { venue_id: string; venue_slug: string; last_played_at: Date; times: number }

let db: DB;
before(async () => { db = await createDb(ds); });
after(async () => { await db.close(); });

describe('venue_past_artists ("já passaram por aqui")', () => {
  for (const v of ds.venues) {
    test(`matches dataset for ${v.slug}`, async () => {
      const r = await db.query<PastArtistRow>('select * from public.venue_past_artists($1, $2)', [v.id, FIXED_NOW]);
      const exp = expectedPastArtists(v.id);
      assert.equal(r.rows.length, exp.size);
      for (const row of r.rows) {
        const e = exp.get(row.artist_id)!;
        assert.ok(e, `unexpected artist ${row.artist_name}`);
        assert.equal(row.times, e.times);
        assert.equal(row.last_played_at.toISOString(), e.last);
      }
      for (let i = 1; i < r.rows.length; i++) {
        assert.ok(r.rows[i - 1].last_played_at >= r.rows[i].last_played_at, 'ordered by last_played_at desc');
      }
    });
  }

  test('closed Casa Caipora keeps its history', async () => {
    const r = await db.query<PastArtistRow>('select * from public.venue_past_artists($1, $2)', [venueId('casa-caipora'), FIXED_NOW]);
    assert.ok(r.rows.length >= 4);
    const maria = r.rows.find((x) => x.artist_id === artistId('maria-goiaba'))!;
    assert.equal(maria.times, 2);
  });

  test('cancelled past events and future events do not count', async () => {
    const r = await db.query<PastArtistRow>('select * from public.venue_past_artists($1, $2)', [venueId('bolt'), FIXED_NOW]);
    assert.ok(!r.rows.some((x) => x.artist_id === artistId('ferrugem-atomica')), 'only in a cancelled show at Bolt');
    for (const row of r.rows) assert.ok(row.last_played_at.getTime() < now);
  });

  test('defaults p_now to now()', async () => {
    const r = await db.query<PastArtistRow>('select * from public.venue_past_artists($1)', [venueId('bolt')]);
    assert.ok(r.rows.length > 0);
  });
});

describe('artist_played_at', () => {
  test('lists venues where an artist played, most recent first', async () => {
    const id = artistId('maria-goiaba');
    const r = await db.query<PlayedAtRow>('select * from public.artist_played_at($1, $2)', [id, FIXED_NOW]);
    const expected = new Map<string, { last: string; times: number }>();
    for (const e of ds.events) {
      if (!e.artistIds.includes(id) || e.status !== 'published' || Date.parse(e.startsAt) >= now) continue;
      const cur = expected.get(e.venueId);
      expected.set(e.venueId, {
        last: !cur || e.startsAt > cur.last ? e.startsAt : cur.last,
        times: (cur?.times ?? 0) + 1,
      });
    }
    assert.equal(r.rows.length, expected.size);
    assert.ok(r.rows.some((x) => x.venue_slug === 'casa-caipora'), 'includes closed venues');
    for (const row of r.rows) {
      assert.equal(row.last_played_at.toISOString(), expected.get(row.venue_id)!.last);
      assert.equal(row.times, expected.get(row.venue_id)!.times);
    }
    for (let i = 1; i < r.rows.length; i++) assert.ok(r.rows[i - 1].last_played_at >= r.rows[i].last_played_at);
  });

  test('artist with only a cancelled show at a venue does not list it', async () => {
    const r = await db.query<PlayedAtRow>('select * from public.artist_played_at($1, $2)', [artistId('ferrugem-atomica'), FIXED_NOW]);
    assert.ok(!r.rows.some((x) => x.venue_slug === 'bolt'));
    assert.ok(r.rows.some((x) => x.venue_slug === 'correria-music-bar'));
  });

  test('works for anon (security invoker + RLS)', async () => {
    await asRole(db, 'anon', null, async () => {
      const r = await db.query<PlayedAtRow>('select * from public.artist_played_at($1, $2)', [artistId('dj-caju'), FIXED_NOW]);
      assert.ok(r.rows.length > 0);
    });
  });
});

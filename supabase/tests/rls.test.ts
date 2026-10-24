import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { DEFAULT_LOCATION } from '../../app/src/domain/types';
import { buildSeed } from '../seed/seed-data';
import { asRole, createDb, FIXED_NOW, search, type DB } from './harness';

const ds = buildSeed(new Date(FIXED_NOW));
const USER_A = '00000000-0000-4000-8000-00000000000a';
const USER_B = '00000000-0000-4000-8000-00000000000b';
const draft = ds.events.find((e) => e.status === 'draft')!;
const cancelled = ds.events.find((e) => e.status === 'cancelled')!;
const published = ds.events.find((e) => e.status === 'published')!;
const venue = ds.venues[0];

let db: DB;
before(async () => {
  db = await createDb(ds);
  await db.exec(`insert into auth.users (id) values ('${USER_A}'), ('${USER_B}')`);
  await db.exec(`insert into public.favorites (user_id, kind, ref_id) values
    ('${USER_A}', 'event', '${published.id}'),
    ('${USER_B}', 'venue', '${venue.id}')`);
  await db.exec(`insert into public.profiles (id, display_name) values ('${USER_A}', 'A'), ('${USER_B}', 'B')`);
});
after(async () => { await db.close(); });

const count = async (sql: string, params: unknown[] = []) =>
  Number((await db.query<{ n: number }>(`select count(*)::int as n from (${sql}) s`, params)).rows[0].n);

describe('RLS: anon', () => {
  test('reads published and cancelled events, never drafts; search_events stays published-only', async () => {
    await asRole(db, 'anon', null, async () => {
      const n = await count('select * from public.events');
      assert.equal(n, ds.events.filter((e) => e.status !== 'draft').length);
      assert.equal(await count('select * from public.events where id = $1', [draft.id]), 0);
      assert.equal(await count('select * from public.events where id = $1', [cancelled.id]), 1);
      assert.ok((await count('select * from public.event_artists where event_id = $1', [cancelled.id])) > 0);
      assert.ok((await count('select * from public.event_genres where event_id = $1', [cancelled.id])) > 0);
      const r = await search(db, {
        lat: DEFAULT_LOCATION.lat, lng: DEFAULT_LOCATION.lng, radiusKm: 500, sort: 'date', limit: 500, now: '2000-01-01T00:00:00Z',
      });
      assert.ok(r.total > 0);
      assert.ok(!r.ids.includes(cancelled.id) && !r.ids.includes(draft.id));
    });
  });

  test('reads venues, artists, genres and join rows of published events only', async () => {
    await asRole(db, 'anon', null, async () => {
      assert.equal(await count('select * from public.venues'), ds.venues.length);
      assert.equal(await count('select * from public.artists'), ds.artists.length);
      assert.equal(await count('select * from public.genres'), ds.genres.length);
      assert.equal(await count('select * from public.event_artists where event_id = $1', [draft.id]), 0);
      assert.equal(await count('select * from public.event_genres where event_id = $1', [draft.id]), 0);
      assert.ok((await count('select * from public.event_artists where event_id = $1', [published.id])) > 0);
    });
  });

  test('can call search_events and the history functions', async () => {
    await asRole(db, 'anon', null, async () => {
      const r = await search(db, {
        lat: DEFAULT_LOCATION.lat, lng: DEFAULT_LOCATION.lng, radiusKm: 50, sort: 'date', now: FIXED_NOW,
      });
      assert.ok(r.total > 0);
      await db.query('select * from public.venue_past_artists($1, $2)', [venue.id, FIXED_NOW]);
      await db.query('select * from public.artist_played_at($1, $2)', [ds.artists[0].id, FIXED_NOW]);
    });
  });

  test('cannot insert, update or delete catalog tables', async () => {
    await asRole(db, 'anon', null, async () => {
      await assert.rejects(db.query(`insert into public.genres (slug, label) values ('x', 'X')`));
      await assert.rejects(db.query(`update public.events set title = 'hack' where id = $1`, [published.id]));
      await assert.rejects(db.query(`delete from public.venues where id = $1`, [venue.id]));
      await assert.rejects(db.query(`delete from public.event_artists`));
      await assert.rejects(db.query(`insert into public.artists (slug, name) values ('x', 'X')`));
    });
    assert.equal(
      (await db.query<{ title: string }>('select title from public.events where id = $1', [published.id])).rows[0].title,
      published.title,
    );
  });

  test('cannot read or write favorites/profiles', async () => {
    await asRole(db, 'anon', null, async () => {
      await assert.rejects(db.query('select * from public.favorites'));
      await assert.rejects(db.query('select * from public.profiles'));
      await assert.rejects(db.query(
        `insert into public.favorites (user_id, kind, ref_id) values ($1, 'event', $2)`, [USER_A, published.id]));
    });
  });
});

describe('RLS: authenticated', () => {
  test('cannot write catalog tables', async () => {
    await asRole(db, 'authenticated', USER_A, async () => {
      await assert.rejects(db.query(`update public.venues set name = 'x'`));
      await assert.rejects(db.query(`insert into public.events (venue_id, title, starts_at) values ($1, 'x', now())`, [venue.id]));
    });
  });

  test('user A sees only own favorites and profile', async () => {
    await asRole(db, 'authenticated', USER_A, async () => {
      const favs = await db.query<{ user_id: string }>('select user_id from public.favorites');
      assert.deepEqual(favs.rows.map((r) => r.user_id), [USER_A]);
      const profs = await db.query<{ id: string }>('select id from public.profiles');
      assert.deepEqual(profs.rows.map((r) => r.id), [USER_A]);
    });
    await asRole(db, 'authenticated', USER_B, async () => {
      const favs = await db.query<{ user_id: string }>('select user_id from public.favorites');
      assert.deepEqual(favs.rows.map((r) => r.user_id), [USER_B]);
    });
  });

  test('user can insert own favorite (default user_id = auth.uid()), not for others', async () => {
    await asRole(db, 'authenticated', USER_A, async () => {
      await db.query(`insert into public.favorites (kind, ref_id) values ('venue', $1)`, [venue.id]);
      await db.query(`insert into public.favorites (user_id, kind, ref_id) values ($1, 'artist', $2)`, [USER_A, ds.artists[0].id]);
      await assert.rejects(
        db.query(`insert into public.favorites (user_id, kind, ref_id) values ($1, 'event', $2)`, [USER_B, published.id]),
        /row-level security/,
      );
      await assert.rejects(
        db.query(`insert into public.favorites (kind, ref_id) values ('venue', $1)`, [venue.id]),
        /duplicate key|favorites_unique/,
      );
      assert.equal(await count('select * from public.favorites'), 3);
    });
  });

  test('user cannot update or delete other users favorites/profiles', async () => {
    await asRole(db, 'authenticated', USER_A, async () => {
      const del = await db.query(`delete from public.favorites where user_id = $1`, [USER_B]);
      assert.equal(del.affectedRows ?? 0, 0);
      const upd = await db.query(`update public.profiles set display_name = 'pwned' where id = $1`, [USER_B]);
      assert.equal(upd.affectedRows ?? 0, 0);
      await assert.rejects(
        db.query(`update public.favorites set user_id = $1 where user_id = $2`, [USER_B, USER_A]),
        /row-level security/,
      );
      const own = await db.query(`update public.profiles set display_name = 'Ana' where id = $1`, [USER_A]);
      assert.equal(own.affectedRows, 1);
    });
    assert.equal(await count(`select * from public.favorites where user_id = $1`, [USER_B]), 1);
    const b = await db.query<{ display_name: string }>('select display_name from public.profiles where id = $1', [USER_B]);
    assert.equal(b.rows[0].display_name, 'B');
  });

  test('unauthenticated JWT (no sub) sees no favorites', async () => {
    await asRole(db, 'authenticated', null, async () => {
      assert.equal(await count('select * from public.favorites'), 0);
    });
  });
});

describe('RLS: service_role', () => {
  test('can write catalog tables and read drafts', async () => {
    await asRole(db, 'service_role', null, async () => {
      await db.query(`insert into public.genres (slug, label, sort_order) values ('teste', 'Teste', 99)`);
      await db.query(`delete from public.genres where slug = 'teste'`);
      assert.equal(await count('select * from public.events where id = $1', [draft.id]), 1);
    });
  });
});

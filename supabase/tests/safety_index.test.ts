import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { buildSeed } from '../seed/seed-data';
import { asRole, createDb, FIXED_NOW, type DB } from './harness';

// Índice de segurança da casa (0020).
const ds = buildSeed(new Date(FIXED_NOW));
const MARE = ds.venues.find((v) => v.slug === 'casa-mare')!.id;
const past = ds.events
  .filter((e) => e.venueId === MARE && e.status === 'published' && Date.parse(e.startsAt) < Date.parse(FIXED_NOW))
  .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
const EV = past[0].id;
const users = Array.from({ length: 7 }, (_, i) => `00000000-0000-4000-8000-0000000000c${i}`);

let db: DB;

const stats = () =>
  asRole(db, 'anon', null, () =>
    db.query<{ sample_size: number; safety_avg: string | null; felt_safe_n: number; felt_safe_share: string | null }>(
      `select * from public.venue_safety_stats($1, $2)`, [MARE, FIXED_NOW])).then((r) => r.rows[0]);

/** Superuser insert: published, attended review with a check-in (as moderation and check_in() would leave it). */
async function review(user: string, seguranca: number | null, feltSafe: string | null, opts: { event?: string; status?: string; checkin?: boolean } = {}) {
  const event = opts.event ?? EV;
  await db.query(`insert into public.checkins (user_id, event_id) values ($1, $2) on conflict do nothing`, [user, event]);
  const topics = seguranca ? { seguranca, musica: 4 } : { musica: 4 };
  const safety = feltSafe ? { felt_safe: feltSafe, harassment: 'nao' } : {};
  await db.query(
    `insert into public.reviews (user_id, event_id, rating, topics, safety, attended, status) values ($1, $2, 4, $3, $4, true, $5)`,
    [user, event, JSON.stringify(topics), JSON.stringify(safety), opts.status ?? 'published']);
  // The trigger needs the check-in at insert time; checkin: false removes it afterwards.
  if (opts.checkin === false) await db.query(`delete from public.checkins where user_id = $1 and event_id = $2`, [user, event]);
}

before(async () => {
  db = await createDb(ds);
  await db.exec(`insert into auth.users (id) values ${users.map((u) => `('${u}')`).join(', ')}`);
});
after(async () => { await db.close(); });

describe('venue safety index (0020)', () => {
  test('answers are validated, need "Foi ao evento" and are never readable', async () => {
    await db.query(`insert into public.checkins (user_id, event_id) values ($1, $2)`, [users[6], past[1].id]);
    const bad = (safety: unknown, attended = true) =>
      assert.rejects(db.query(`insert into public.reviews (user_id, event_id, rating, safety, attended) values ($1, $2, 3, $3, $4)`,
        [users[6], past[1].id, JSON.stringify(safety), attended]), /check constraint/);
    await bad({ felt_safe: 'talvez' });
    await bad({ felt_safe: 1 });
    await bad({ outra: 'sim' });
    await bad({ felt_safe: 'sim' }, false);
    await asRole(db, 'authenticated', users[0], () =>
      assert.rejects(db.query(`select safety from public.reviews`), /permission denied/));
    await asRole(db, 'anon', null, () =>
      assert.rejects(db.query(`select safety from public.reviews_feed`), /does not exist/));
  });

  test('below 5 reviews only the count shows', async () => {
    for (let i = 0; i < 4; i++) await review(users[i], 5, 'sim');
    assert.deepEqual(await stats(), { sample_size: 4, safety_avg: null, felt_safe_n: 4, felt_safe_share: null });
  });

  test('pending, check-in-less and old reviews do not count', async () => {
    await review(users[4], 1, 'nao', { status: 'pending' });
    await review(users[5], 1, 'nao', { checkin: false });
    const old = ds.events.find((e) => e.venueId === MARE && Date.parse(e.startsAt) < Date.parse(FIXED_NOW) - 200 * 86_400_000);
    if (old) await review(users[6], 1, 'nao', { event: old.id });
    assert.equal((await stats()).sample_size, 4);
  });

  test('from 5 reviews: average of Segurança and the share who felt safe', async () => {
    await db.query(`update public.reviews set status = 'published' where user_id = $1`, [users[4]]);
    // 5,5,5,5,1 -> 4.2; felt safe 4 of 5 -> 0.80
    assert.deepEqual(await stats(), { sample_size: 5, safety_avg: '4.2', felt_safe_n: 5, felt_safe_share: '0.80' });
    // A review without the Segurança topic and without answers changes nothing.
    await db.query(`delete from public.reviews where user_id = $1`, [users[5]]);
    await review(users[5], null, null, { event: past[1].id });
    assert.equal((await stats()).sample_size, 5);
  });

  test('a deleted check-in drops the review from the index', async () => {
    await db.query(`delete from public.checkins where user_id = $1 and event_id = $2`, [users[0], EV]);
    assert.deepEqual(await stats(), { sample_size: 4, safety_avg: null, felt_safe_n: 4, felt_safe_share: null });
  });

  test('search_events returns the venue seal', async () => {
    await db.query(`update public.venues set safety_protocol = 'verified' where id = $1`, [MARE]);
    const r = await db.query<{ venue_id: string; venue_safety_protocol: string | null }>(
      `select venue_id, venue_safety_protocol from public.search_events(-20.2976, -40.2958, 50, p_now => $1, p_limit => 200)`, [FIXED_NOW]);
    assert.ok(r.rows.length > 0);
    for (const row of r.rows) assert.equal(row.venue_safety_protocol, row.venue_id === MARE ? 'verified' : null);
  });
});

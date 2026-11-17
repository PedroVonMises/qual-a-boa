import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { buildSeed } from '../seed/seed-data';
import { asRole, createDb, FIXED_NOW, type DB } from './harness';

// Denúncia de assédio (0021).
const ds = buildSeed(new Date(FIXED_NOW));
const MARE = ds.venues.find((v) => v.slug === 'casa-mare')!.id;
const BOLT = ds.venues.find((v) => v.slug === 'bolt')!.id;
const EV = ds.events.find((e) => e.venueId === MARE && e.status === 'published')!.id;
const OTHER_EV = ds.events.find((e) => e.venueId === BOLT && e.status === 'published')!.id;
const U = Array.from({ length: 6 }, (_, i) => `00000000-0000-4000-8000-0000000000d${i}`);
const FRESH = '00000000-0000-4000-8000-0000000000e1';
const ANON = '00000000-0000-4000-8000-0000000000e2';

let db: DB;

const report = (user: string, opts: { venue?: string; event?: string | null; kind?: string; text?: string } = {}) =>
  asRole(db, 'authenticated', user, () =>
    db.query<{ id: string }>(`select public.report_safety_incident($1, $2, $3, $4) as id`, [
      opts.venue ?? MARE, opts.event === undefined ? EV : opts.event, opts.kind ?? 'assedio', opts.text ?? 'Um homem me seguiu até o banheiro.',
    ])).then((r) => r.rows[0].id);
const seal = () => db.query<{ s: string | null }>(`select safety_protocol s from public.venues where id = $1`, [MARE]).then((r) => r.rows[0].s);
const checkIn = (user: string, event = EV) =>
  db.query(`insert into public.checkins (user_id, event_id) values ($1, $2) on conflict do nothing`, [user, event]);

before(async () => {
  db = await createDb(ds);
  await db.exec(`insert into auth.users (id, created_at) values ${U.map((u) => `('${u}', now() - interval '30 days')`).join(', ')}`);
  await db.exec(`insert into auth.users (id) values ('${FRESH}')`);
  await db.exec(`insert into auth.users (id, is_anonymous, created_at) values ('${ANON}', true, now() - interval '30 days')`);
  await db.query(`update public.venues set safety_protocol = 'verified', safety_protocol_at = now() - interval '1 day' where id = $1`, [MARE]);
});
after(async () => { await db.close(); });

describe('safety reports (0021)', () => {
  test('validates input; anon cannot report', async () => {
    await asRole(db, 'anon', null, () =>
      assert.rejects(db.query(`select public.report_safety_incident($1, null, 'assedio', 'x')`, [MARE]), /permission denied/));
    await assert.rejects(report(U[0], { kind: 'briga' }), /invalid_kind/);
    await assert.rejects(report(U[0], { text: '   ' }), /invalid_description/);
    await assert.rejects(report(U[0], { venue: '00000000-0000-4000-8000-00000000ffff' }), /venue_not_found/);
    await assert.rejects(report(U[0], { event: OTHER_EV }), /event_not_found/);
  });

  test('creates a private seguranca ticket the reporter sees; nobody reads the report row', async () => {
    const id = await report(U[0], { event: null });
    const t = await asRole(db, 'authenticated', U[0], () =>
      db.query<{ topic: string; description: string }>(`select topic, description from public.support_tickets where id = $1`, [id]));
    assert.deepEqual(t.rows[0], { topic: 'seguranca', description: 'Um homem me seguiu até o banheiro.' });
    await asRole(db, 'authenticated', U[1], async () => {
      assert.equal((await db.query(`select 1 from public.support_tickets where id = $1`, [id])).rows.length, 0);
    });
    for (const role of ['authenticated', 'anon'] as const) {
      await asRole(db, role, role === 'anon' ? null : U[0], () =>
        assert.rejects(db.query(`select * from public.safety_reports`), /permission denied/));
    }
    const r = await db.query<{ checked_in: boolean; kind: string }>(`select checked_in, kind from public.safety_reports where ticket_id = $1`, [id]);
    assert.deepEqual(r.rows[0], { checked_in: false, kind: 'assedio' });
    assert.equal(await seal(), 'verified');
  });

  test('3 people who checked in contest the seal; anonymous and fresh accounts do not count', async () => {
    for (const u of [U[1], U[2], FRESH, ANON]) await checkIn(u);
    await report(U[1]);
    await report(FRESH);
    await report(ANON);
    assert.equal(await seal(), 'verified');
    await report(U[2]);
    // U[0] reported without a check-in: still only U[1] and U[2] count.
    assert.equal(await seal(), 'verified');
    await checkIn(U[3]);
    await report(U[3]);
    assert.equal(await seal(), 'contested');
  });

  test('a staff review starts the count again', async () => {
    // What review_safety_protocol(venue, 'verify') does to the venue (no casa declared it in this fixture).
    await db.query(`update public.venues set safety_protocol = 'verified', safety_protocol_at = now() where id = $1`, [MARE]);
    assert.equal(await seal(), 'verified');
    await checkIn(U[4]);
    await report(U[4]);
    assert.equal(await seal(), 'verified');
  });

  test('3 reports per person per day', async () => {
    await report(U[5], { venue: BOLT, event: null });
    await report(U[5], { venue: BOLT, event: null });
    await report(U[5], { venue: BOLT, event: null });
    await assert.rejects(report(U[5], { venue: BOLT, event: null }), /rate_limited/);
  });
});

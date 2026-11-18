import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { asRole, createDb, type DB } from './harness';

// Aprovação da ingestão no /admin (0025).
const S = '00000000-0000-4000-8000-0000000000d1'; // staff
const U = '00000000-0000-4000-8000-0000000000d2'; // regular user

let db: DB;
const as = <T>(user: string | null, fn: () => Promise<T>) => asRole(db, user ? 'authenticated' : 'anon', user, fn);
const asService = <T>(fn: () => Promise<T>) => asRole(db, 'service_role', null, fn);
const ahead = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

/** What the ingest run does: PostgREST upsert on `key` with the fields it knows (never status). */
const upsert = (key: string, title: string, startsAt: string) =>
  asService(() => db.query(
    `insert into public.ingest_candidates (key, tier, title, starts_at, venue_name, source_url, flags, details, last_seen_at)
     values ($1, 2, $2, $3, 'Bolt', 'https://www.sympla.com.br/evento/x', '{venue-unverified}', '{"price":"R$ 30"}', now())
     on conflict (key) do update set title = excluded.title, starts_at = excluded.starts_at, last_seen_at = excluded.last_seen_at,
       status = 'pending', review_note = null`,
    [key, title, startsAt]));
const queue = () => as(S, () => db.query<{ id: string; key: string; title: string; flags: string[]; details: Record<string, unknown> }>(
  `select * from public.admin_ingest_queue()`)).then((r) => r.rows);
const state = (key: string) => asService(() => db.query<{ status: string; review_note: string | null; title: string }>(
  `select status, review_note, title from public.ingest_candidates where key = $1`, [key])).then((r) => r.rows[0]);

before(async () => {
  db = await createDb();
  await db.exec(`insert into auth.users (id) values ('${S}'), ('${U}')`);
  await asService(() => db.exec(`insert into public.staff_members (user_id) values ('${S}')`));
});
after(async () => { await db.close(); });

describe('ingest review (0025)', () => {
  test('clients cannot touch the table; non-staff cannot call the functions', async () => {
    await as(S, () => assert.rejects(db.query(`select * from public.ingest_candidates`), /permission denied/));
    await as(U, () => assert.rejects(db.query(`select * from public.admin_ingest_queue()`), /not_staff/));
    await as(null, () => assert.rejects(db.query(`select * from public.admin_ingest_queue()`), /permission denied/));
  });

  test('pending records are queued soonest first; past nights drop out', async () => {
    await upsert('link:bbb', 'Depois', ahead(48));
    await upsert('link:aaa', 'Antes', ahead(5));
    await upsert('link:old', 'Passou', ahead(-20));
    const q = await queue();
    assert.deepEqual(q.map((x) => x.key), ['link:aaa', 'link:bbb']);
    assert.deepEqual(q[0].flags, ['venue-unverified']);
    assert.equal(q[0].details.price, 'R$ 30');
    const o = (await as(S, () => db.query<{ ingest_pending: number }>(`select * from public.admin_overview()`))).rows[0];
    assert.equal(o.ingest_pending, 2);
  });

  test('staff approve, refuse only with a reason; decisions are logged', async () => {
    const [a, b] = await queue();
    await as(S, () => assert.rejects(db.query(`select public.admin_review_ingest($1, false, 'x')`, [b.id]), /note_required/));
    assert.equal((await as(S, () => db.query<{ s: string }>(`select public.admin_review_ingest($1, true) s`, [a.id]))).rows[0].s, 'approved');
    assert.equal((await as(S, () => db.query<{ s: string }>(`select public.admin_review_ingest($1, false, 'Evento repetido') s`, [b.id]))).rows[0].s, 'rejected');
    await as(S, () => assert.rejects(db.query(`select public.admin_review_ingest($1, true)`, [a.id]), /not_pending/));
    await as(S, () => assert.rejects(db.query(`select public.admin_review_ingest($1, true)`, [S]), /candidate_not_found/));
    assert.deepEqual(await queue(), []);
    const log = (await asService(() => db.query<{ action: string; target_type: string; details: { key: string } }>(
      `select action, target_type, details from public.admin_actions order by created_at, action`))).rows;
    assert.deepEqual(log.map((l) => [l.action, l.target_type, l.details.key]).sort(),
      [['ingest_approve', 'ingest_candidate', 'link:aaa'], ['ingest_reject', 'ingest_candidate', 'link:bbb']]);
  });

  test('a later ingest run refreshes the record but never undoes the decision', async () => {
    await upsert('link:aaa', 'Antes (novo título)', ahead(6));
    await upsert('link:bbb', 'Depois', ahead(48));
    assert.deepEqual(await state('link:aaa'), { status: 'approved', review_note: null, title: 'Antes (novo título)' });
    assert.deepEqual(await state('link:bbb'), { status: 'rejected', review_note: 'Evento repetido', title: 'Depois' });
  });
});

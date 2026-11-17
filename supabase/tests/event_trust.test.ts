import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { buildSeed } from '../seed/seed-data';
import { asRole, createDb, FIXED_NOW, type DB } from './harness';

// Fonte, conferência e dress code do evento (0023).
const ds = buildSeed(new Date(FIXED_NOW));
const MARE = ds.venues.find((v) => v.slug === 'casa-mare')!.id;
const O = '00000000-0000-4000-8000-0000000000f5';
const CNPJ = '11222333000181';

let db: DB;
let acc: string;

const as = <T>(user: string | null, fn: () => Promise<T>) => asRole(db, user ? 'authenticated' : 'anon', user, fn);
const asService = <T>(fn: () => Promise<T>) => asRole(db, 'service_role', null, fn);
const startsAt = () => new Date(Date.now() + 10 * 86_400_000).toISOString();
const submit = (extra: Record<string, unknown> = {}) =>
  as(O, () => db.query<{ id: string }>(`select public.submit_event($1, $2::jsonb) as id`, [
    acc, JSON.stringify({ title: 'Noite de Teste', starts_at: startsAt(), is_free: true, ...extra }),
  ])).then((r) => r.rows[0].id);
const row = (id: string) =>
  as(null, () => db.query<{ dress_code: string | null; verified_at: string | null; status: string }>(
    `select dress_code, verified_at, status from public.events where id = $1`, [id])).then((r) => r.rows[0]);

before(async () => {
  db = await createDb(ds);
  await db.exec(`insert into auth.users (id) values ('${O}')`);
  acc = (await as(O, () =>
    db.query<{ id: string }>(`select public.claim_venue($1, null, $2, 'Casa Maré Ltda', 'Ana', '+5527999990000') as id`, [MARE, CNPJ]))).rows[0].id;
  await db.exec(`update public.venue_accounts set status = 'verified' where id = '${acc}';
    insert into public.subscriptions (venue_account_id, stripe_customer_id, status, current_period_start, current_period_end)
    values ('${acc}', 'cus_1', 'active', now(), now() + interval '60 days')`);
});
after(async () => { await db.close(); });

describe('event trust fields (0023)', () => {
  test('the casa sends a dress code; it is trimmed and validated', async () => {
    await assert.rejects(submit({ dress_code: 'x' }), /invalid_payload/);
    await assert.rejects(submit({ dress_code: 'x'.repeat(81) }), /invalid_payload/);
    const id = await submit({ dress_code: '  Esporte   fino ' });
    assert.deepEqual(await asService(() => db.query(`select dress_code, verified_at from public.events where id = $1`, [id])).then((r) => r.rows[0]),
      { dress_code: 'Esporte fino', verified_at: null });
    const none = await submit({ dress_code: '   ' });
    assert.equal((await asService(() => db.query<{ d: string | null }>(`select dress_code d from public.events where id = $1`, [none]))).rows[0].d, null);
  });

  test('approval stamps verified_at; rejection does not; verify_event re-confirms (staff only)', async () => {
    const ok = await submit({ dress_code: 'Livre' });
    const no = await submit();
    await asService(() => db.query(`select public.review_event($1, true)`, [ok]));
    await asService(() => db.query(`select public.review_event($1, false, 'Data errada')`, [no]));
    const approved = await row(ok);
    assert.equal(approved.status, 'published');
    assert.equal(approved.dress_code, 'Livre');
    assert.ok(approved.verified_at);
    const rejected = (await asService(() => db.query<{ verified_at: string | null }>(`select verified_at from public.events where id = $1`, [no]))).rows[0];
    assert.equal(rejected.verified_at, null);

    await as(O, () => assert.rejects(db.query(`select public.verify_event($1)`, [ok]), /permission denied/));
    await assert.rejects(asService(() => db.query(`select public.verify_event($1)`, [no])), /event_not_found/);
    const at = (await asService(() => db.query<{ at: string }>(`select public.verify_event($1) as at`, [ok]))).rows[0].at;
    assert.ok(Date.parse(at) >= Date.parse(approved.verified_at!));
  });

  test('clients cannot write the fields directly', async () => {
    await as(O, () => assert.rejects(db.query(`update public.events set verified_at = now()`), /permission denied/));
    await assert.rejects(db.query(`update public.events set dress_code = 'x' where venue_id = $1`, [MARE]), /check constraint/);
  });
});

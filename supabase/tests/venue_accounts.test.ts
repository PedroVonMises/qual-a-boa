import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { buildSeed } from '../seed/seed-data';
import { asRole, createDb, FIXED_NOW, type DB } from './harness';

const ds = buildSeed(new Date(FIXED_NOW));
const MARE = ds.venues.find((v) => v.slug === 'casa-mare')!.id;
const BOLT = ds.venues.find((v) => v.slug === 'bolt')!.id;
const O = '00000000-0000-4000-8000-0000000000a1'; // owner
const E = '00000000-0000-4000-8000-0000000000a2'; // editor
const X = '00000000-0000-4000-8000-0000000000a3'; // stranger
const CNPJ = '11222333000181';
const CNPJ2 = '11444777000161';
const CNPJ3 = '45723174000110';

let db: DB;
let acc: string;
/** First day (YYYY-MM-DD) of the SP calendar month `offset` months after the current one. */
let M2: string;
let M3: string;

before(async () => {
  db = await createDb(ds);
  await db.exec(`insert into auth.users (id) values ('${O}'), ('${E}'), ('${X}')`);
  const r = await db.query<{ m2: string; m3: string }>(`select
    to_char(date_trunc('month', now() at time zone 'America/Sao_Paulo') + interval '2 months', 'YYYY-MM-DD') m2,
    to_char(date_trunc('month', now() at time zone 'America/Sao_Paulo') + interval '3 months', 'YYYY-MM-DD') m3`);
  ({ m2: M2, m3: M3 } = r.rows[0]);
});
after(async () => { await db.close(); });

const as = <T>(user: string | null, fn: () => Promise<T>) =>
  asRole(db, user ? 'authenticated' : 'anon', user, fn);
const asService = <T>(fn: () => Promise<T>) => asRole(db, 'service_role', null, fn);
const day = (month: string, d: number) => `${month.slice(0, 8)}${String(d).padStart(2, '0')}`;
/** Local São Paulo wall time on day `d` of `month`. */
const at = (month: string, d: number, hhmm = '23:00') => `${day(month, d)}T${hhmm}:00-03:00`;

const claim = (venue: string | null, cnpj: string, proposed: unknown = null) =>
  db.query<{ id: string }>(`select public.claim_venue($1, $2::jsonb, $3, 'Casa Maré Ltda', 'Ana', '+55 27 99999-0000') as id`,
    [venue, proposed === null ? null : JSON.stringify(proposed), cnpj]);
const payload = (startsAt: string, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ title: 'Noite de Teste', starts_at: startsAt, price_min: 20, price_max: 40, genre_slugs: ['funk'], ...extra });
const submit = (account: string, startsAt: string, extra: Record<string, unknown> = {}) =>
  db.query<{ id: string }>(`select public.submit_event($1, $2::jsonb) as id`, [account, payload(startsAt, extra)])
    .then((r) => r.rows[0].id);
const setSub = (fields: string) => asService(() => db.exec(`update public.subscriptions set ${fields} where venue_account_id = '${acc}'`));
const quota = async (month: string) =>
  (await as(O, () => db.query<{ used: number; limit: number }>(`select * from public.venue_quota($1, $2::date)`, [acc, month]))).rows[0];
const count = async (sql: string, params: unknown[] = []) =>
  Number((await db.query<{ n: number }>(`select count(*)::int as n from (${sql}) s`, params)).rows[0].n);
const clearEvents = () => asService(() => db.exec(`delete from public.events where venue_account_id = '${acc}'`));

describe('is_valid_cnpj', () => {
  test('checks the two check digits', async () => {
    const r = await db.query<Record<string, boolean>>(`select public.is_valid_cnpj('11222333000181') a,
      public.is_valid_cnpj('11222333000182') b, public.is_valid_cnpj('11111111111111') c,
      public.is_valid_cnpj('1122233300018') d, public.is_valid_cnpj('11.222.333/0001-81') e,
      public.is_valid_cnpj('${CNPJ2}') f, public.is_valid_cnpj('${CNPJ3}') g`);
    assert.deepEqual(r.rows[0], { a: true, b: false, c: false, d: false, e: false, f: true, g: true });
  });

  test('the plan is seeded', async () => {
    const r = await as(null, () => db.query(`select code, price_cents, events_per_month, active from public.plans`));
    assert.deepEqual(r.rows, [{ code: 'casa_mensal', price_cents: 29900, events_per_month: 4, active: true }]);
  });
});

describe('claim_venue', () => {
  test('anon cannot call it', async () => {
    await as(null, () => assert.rejects(claim(MARE, CNPJ), /permission denied/));
  });

  test('validates CNPJ and payload', async () => {
    await as(O, async () => {
      await assert.rejects(claim(MARE, '11222333000182'), /invalid_cnpj/);
      await assert.rejects(claim(null, CNPJ), /invalid_payload/);
      await assert.rejects(claim(MARE, CNPJ, { name: 'x', address: 'y' }), /invalid_payload/);
      await assert.rejects(claim(randomUUID(), CNPJ), /venue_not_found/);
    });
  });

  test('creates a pending account with the caller as owner (masked CNPJ accepted)', async () => {
    acc = (await as(O, () => claim(MARE, '11.222.333/0001-81'))).rows[0].id;
    const r = await asService(() => db.query(`select status, cnpj, whatsapp, created_by, venue_id from public.venue_accounts where id = $1`, [acc]));
    assert.deepEqual(r.rows[0], { status: 'pending', cnpj: CNPJ, whatsapp: '+5527999990000', created_by: O, venue_id: MARE });
    const m = await asService(() => db.query(`select user_id, role from public.venue_members where venue_account_id = $1`, [acc]));
    assert.deepEqual(m.rows, [{ user_id: O, role: 'owner' }]);
  });

  test('one live claim per venue and per CNPJ', async () => {
    await as(X, async () => {
      await assert.rejects(claim(MARE, CNPJ2), /venue_taken/);
      await assert.rejects(claim(BOLT, CNPJ), /cnpj_taken/);
    });
  });

  test('a casa that is not in the catalog yet is claimed with a proposal', async () => {
    const id = (await as(X, () => claim(null, CNPJ2, { name: 'Casa Nova', address: 'Rua A, 10', bairro: 'Centro', cep: '29010-000', lat: -20.3, lng: -40.3 }))).rows[0].id;
    const r = await asService(() => db.query<{ venue_id: string | null; name: string }>(
      `select venue_id, proposed_venue->>'name' as name from public.venue_accounts where id = $1`, [id]));
    assert.deepEqual(r.rows[0], { venue_id: null, name: 'Casa Nova' });
  });
});

describe('RLS', () => {
  test('members read their own account, members and subscription; strangers and anon see nothing', async () => {
    await asService(() => db.exec(`insert into public.venue_members (venue_account_id, user_id, role) values ('${acc}', '${E}', 'editor');
      insert into public.subscriptions (venue_account_id, stripe_customer_id, status) values ('${acc}', 'cus_1', 'incomplete')`));
    for (const user of [O, E]) {
      await as(user, async () => {
        assert.equal(await count(`select 1 from public.venue_accounts where id = $1`, [acc]), 1);
        assert.equal(await count(`select 1 from public.venue_members where venue_account_id = $1`, [acc]), 2);
        assert.equal(await count(`select 1 from public.subscriptions where venue_account_id = $1`, [acc]), 1);
      });
    }
    await as(X, async () => {
      assert.equal(await count(`select 1 from public.venue_accounts where id = $1`, [acc]), 0);
      assert.equal(await count(`select 1 from public.venue_members where venue_account_id = $1`, [acc]), 0);
      assert.equal(await count(`select 1 from public.subscriptions`), 0);
    });
    await as(null, () => assert.rejects(db.query(`select * from public.venue_accounts`), /permission denied/));
  });

  test('clients never write accounts, members, subscriptions or billing events', async () => {
    await as(O, async () => {
      await assert.rejects(db.exec(`update public.subscriptions set status = 'active'`), /permission denied/);
      await assert.rejects(db.exec(`insert into public.subscriptions (venue_account_id, status) values ('${acc}', 'active')`), /permission denied/);
      await assert.rejects(db.exec(`update public.venue_accounts set status = 'verified'`), /permission denied/);
      await assert.rejects(db.exec(`insert into public.venue_members values ('${acc}', '${X}', 'owner')`), /permission denied/);
      await assert.rejects(db.query(`select * from public.billing_events`), /permission denied/);
      await assert.rejects(db.query(`select public.review_event($1, true, null)`, [randomUUID()]), /permission denied/);
      await assert.rejects(db.query(`select public.blocks_account_deletion($1)`, [O]), /permission denied/);
    });
  });
});

describe('submit_event gating', () => {
  test('a pending account cannot submit', async () => {
    await as(O, () => assert.rejects(submit(acc, at(M2, 10)), /account_not_verified/));
  });

  test('a verified account needs a live subscription', async () => {
    await asService(() => db.exec(`update public.venue_accounts set status = 'verified' where id = '${acc}'`));
    await as(O, () => assert.rejects(submit(acc, at(M2, 10)), /subscription_inactive/));
    await setSub(`status = 'canceled', current_period_end = now() + interval '200 days'`);
    await as(O, () => assert.rejects(submit(acc, at(M2, 10)), /subscription_inactive/));
    await setSub(`status = 'past_due', current_period_end = now() - interval '1 hour'`);
    await as(O, () => assert.rejects(submit(acc, at(M2, 10)), /subscription_inactive/));
  });

  test('past_due still inside the paid period may submit', async () => {
    await setSub(`status = 'past_due', current_period_start = now(), current_period_end = now() + interval '200 days'`);
    const id = await as(O, () => submit(acc, at(M2, 10)));
    assert.match(id, /^[0-9a-f-]{36}$/);
    await setSub(`status = 'active'`);
    await clearEvents();
  });

  test('editors submit, strangers do not', async () => {
    await as(E, () => submit(acc, at(M2, 11)));
    await as(X, () => assert.rejects(submit(acc, at(M2, 12)), /not_member/));
    await as(X, () => assert.rejects(db.query(`select * from public.venue_quota($1, $2::date)`, [acc, M2]), /not_member/));
    await clearEvents();
  });

  test('payload is validated with clear codes', async () => {
    await as(O, async () => {
      await assert.rejects(submit(acc, '2020-01-01T23:00:00-03:00'), /starts_in_past/);
      await assert.rejects(submit(acc, at(M2, 10), { title: 'x' }), /invalid_payload/);
      await assert.rejects(submit(acc, 'amanhã'), /invalid_payload/);
      await assert.rejects(submit(acc, at(M2, 10), { ends_at: at(M2, 9) }), /invalid_payload/);
      await assert.rejects(submit(acc, at(M2, 10), { ticket_url: 'http://x.com' }), /invalid_ticket_url/);
      await assert.rejects(submit(acc, at(M2, 10), { age_min: 16 }), /invalid_age/);
      await assert.rejects(submit(acc, at(M2, 10), { genre_slugs: ['nao-existe'] }), /invalid_genre/);
      await assert.rejects(submit(acc, at(M2, 10), { price_min: 50, price_max: 10 }), /invalid_price/);
      await assert.rejects(submit(acc, at(M2, 10), { is_free: true, price_min: 10 }), /invalid_price/);
      await assert.rejects(submit(acc, at(M2, 10), { poster_path: `${randomUUID()}/${randomUUID()}.jpg` }), /invalid_poster/);
    });
  });

  test('inserts a pending_review festa at the account venue with the venue cover and genres', async () => {
    const poster = `${acc}/${randomUUID()}.webp`;
    const id = await as(O, () => submit(acc, at(M2, 10), { is_free: true, price_min: null, price_max: null, ticket_url: 'https://ingresso.com/x', poster_path: poster }));
    const r = await asService(() => db.query(`select e.status::text, e.venue_id, e.cover_key, e.submitted_by, e.is_free, e.price_min, e.poster_path,
      array(select genre_slug from public.event_genres g where g.event_id = e.id) genres from public.events e where e.id = $1`, [id]));
    assert.deepEqual(r.rows[0], { status: 'pending_review', venue_id: MARE, cover_key: 'mare', submitted_by: O, is_free: true, price_min: null, poster_path: poster, genres: ['funk'] });
    await clearEvents();
  });
});

describe('quota: 4 festas per party month', () => {
  test('4 fit, the 5th is quota_exceeded, rejected gives the slot back', async () => {
    const ids: string[] = [];
    for (const d of [3, 10, 17, 24]) ids.push(await as(O, () => submit(acc, at(M2, d))));
    assert.deepEqual(await quota(M2), { used: 4, limit: 4 });
    await as(O, () => assert.rejects(submit(acc, at(M2, 27)), /quota_exceeded/));
    // Other months are independent.
    await as(O, () => submit(acc, at(M3, 5)));

    await asService(() => db.query(`select public.review_event($1, false, 'Data errada')`, [ids[0]]));
    assert.deepEqual(await quota(M2), { used: 3, limit: 4 });
    ids[0] = await as(O, () => submit(acc, at(M2, 27)));
    assert.deepEqual(await quota(M2), { used: 4, limit: 4 });
  });

  test('published and cancelled festas keep counting; withdrawing a pending one frees it', async () => {
    const [pub, pend] = (await asService(() => db.query<{ id: string }>(
      `select id from public.events where venue_account_id = $1 and status::text = 'pending_review' and party_month(starts_at) = $2::date order by starts_at`, [acc, M2]))).rows.map((r) => r.id);
    assert.equal((await asService(() => db.query<{ s: string }>(`select public.review_event($1, true, null) s`, [pub]))).rows[0].s, 'published');
    await asService(() => assert.rejects(db.query(`select public.review_event($1, true, null)`, [pub]), /not_pending/));
    assert.equal((await as(O, () => db.query<{ s: string }>(`select public.cancel_event_submission($1) s`, [pub]))).rows[0].s, 'cancelled');
    assert.deepEqual(await quota(M2), { used: 4, limit: 4 });
    await as(O, () => assert.rejects(db.query(`select public.cancel_event_submission($1)`, [pub]), /not_cancellable/));
    await as(X, () => assert.rejects(db.query(`select public.cancel_event_submission($1)`, [pend]), /event_not_found/));

    assert.equal((await as(O, () => db.query<{ s: string }>(`select public.cancel_event_submission($1) s`, [pend]))).rows[0].s, 'rejected');
    const r = await asService(() => db.query(`select status::text, review_note from public.events where id = $1`, [pend]));
    assert.deepEqual(r.rows[0], { status: 'rejected', review_note: 'Retirada pela casa' });
    assert.deepEqual(await quota(M2), { used: 3, limit: 4 });
  });

  test('night rule: 03:00 on day 1 belongs to the previous month, 07:00 does not', async () => {
    // M2 has 3 used: a festa at 03:00 on day 1 of M3 is the night of the last day of M2.
    await as(O, () => submit(acc, at(M3, 1, '03:00')));
    assert.deepEqual(await quota(M2), { used: 4, limit: 4 });
    await as(O, () => assert.rejects(submit(acc, at(M3, 1, '05:59')), /quota_exceeded/));
    const before = (await quota(M3)).used;
    await as(O, () => submit(acc, at(M3, 1, '07:00')));
    assert.equal((await quota(M3)).used, before + 1);
  });

  test('concurrent submissions never exceed the quota', async () => {
    await clearEvents();
    for (const d of [3, 10, 17]) await as(O, () => submit(acc, at(M2, d)));
    const results = await as(O, () => Promise.allSettled([submit(acc, at(M2, 20)), submit(acc, at(M2, 21))]));
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    assert.match(String(failed.reason), /quota_exceeded/);
    assert.deepEqual(await quota(M2), { used: 4, limit: 4 });
    await clearEvents();
  });
});

describe('paid period', () => {
  test('without cancellation: up to the month of current_period_end', async () => {
    const end = `${day(M2, 15)}T12:00:00-03:00`;
    await setSub(`status = 'active', cancel_at_period_end = false, current_period_end = '${end}'`);
    await as(O, () => submit(acc, at(M2, 28)));
    await as(O, () => assert.rejects(submit(acc, at(M3, 5)), /beyond_paid_period/));
  });

  test('with cancel_at_period_end: not after current_period_end', async () => {
    await setSub(`cancel_at_period_end = true`);
    await as(O, () => submit(acc, at(M2, 14)));
    await as(O, () => assert.rejects(submit(acc, at(M2, 16)), /beyond_paid_period/));
    await setSub(`cancel_at_period_end = false, current_period_end = now() + interval '200 days'`);
    await clearEvents();
  });
});

describe('visibility of submissions', () => {
  test('members see their pending festas (and genres); the public and strangers do not', async () => {
    const id = await as(O, () => submit(acc, at(M2, 9)));
    await as(E, async () => {
      assert.equal(await count(`select 1 from public.events where id = $1`, [id]), 1);
      assert.equal(await count(`select 1 from public.event_genres where event_id = $1`, [id]), 1);
    });
    for (const user of [X, null]) {
      await as(user, async () => {
        assert.equal(await count(`select 1 from public.events where id = $1`, [id]), 0);
        assert.equal(await count(`select 1 from public.event_genres where event_id = $1`, [id]), 0);
      });
    }
    await asService(() => db.query(`select public.review_event($1, true, null)`, [id]));
    await as(null, async () => assert.equal(await count(`select 1 from public.events where id = $1`, [id]), 1));
  });

  test('my_venue_accounts summarizes account, venue, subscription and usage', async () => {
    const r = await as(O, () => db.query<Record<string, unknown>>(`select * from public.my_venue_accounts()`));
    assert.equal(r.rows.length, 1);
    const row = r.rows[0];
    assert.equal(row.account_id, acc);
    assert.equal(row.role, 'owner');
    assert.equal(row.venue_name, 'Casa Maré');
    assert.equal(row.subscription_status, 'active');
    assert.equal(row.events_per_month, 4);
    assert.equal(row.price_cents, 29900);
    assert.equal(row.can_submit, true);
    assert.equal(typeof row.used_current_month, 'number');
    assert.equal((await as(X, () => db.query(`select * from public.my_venue_accounts()`))).rows.length, 1); // X's own proposal
    assert.equal((await as(E, () => db.query<{ role: string }>(`select role from public.my_venue_accounts()`))).rows[0].role, 'editor');
  });
});

describe('event-posters storage', () => {
  const put = (name: string) => db.query(`insert into storage.objects (bucket_id, name) values ('event-posters', $1)`, [name]);

  test('bucket is private, 5 MB, images only', async () => {
    const r = await db.query(`select public, file_size_limit::int as size, allowed_mime_types from storage.buckets where id = 'event-posters'`);
    assert.deepEqual(r.rows[0], { public: false, size: 5242880, allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp'] });
  });

  test('members write and read their account folder only', async () => {
    const mine = `${acc}/${randomUUID()}.jpg`;
    await as(E, () => put(mine));
    await as(X, () => assert.rejects(put(`${acc}/${randomUUID()}.jpg`), /row-level security/));
    await as(X, () => assert.rejects(put(`not-a-uuid/${randomUUID()}.jpg`), /row-level security/));
    await as(O, async () => assert.equal(await count(`select 1 from storage.objects where name = $1`, [mine]), 1));
    await as(X, async () => assert.equal(await count(`select 1 from storage.objects where name = $1`, [mine]), 0));
    await as(null, async () => assert.equal(await count(`select 1 from storage.objects where name = $1`, [mine]), 0));
  });

  test('a poster linked to a published festa is public', async () => {
    const poster = `${acc}/${randomUUID()}.png`;
    await as(O, () => put(poster));
    const id = await as(O, () => submit(acc, at(M2, 20), { poster_path: poster }));
    await as(null, async () => assert.equal(await count(`select 1 from storage.objects where name = $1`, [poster]), 0));
    await asService(() => db.query(`select public.review_event($1, true, null)`, [id]));
    await as(null, async () => assert.equal(await count(`select 1 from storage.objects where name = $1`, [poster]), 1));
  });
});

describe('blocks_account_deletion', () => {
  test('true only for the sole owner of an account with a live subscription', async () => {
    const blocks = async (u: string) =>
      (await asService(() => db.query<{ b: boolean }>(`select public.blocks_account_deletion($1) b`, [u]))).rows[0].b;
    assert.equal(await blocks(O), true);
    assert.equal(await blocks(E), false); // editor
    assert.equal(await blocks(X), false); // no subscription
    await setSub(`status = 'canceled'`);
    assert.equal(await blocks(O), false);
    await setSub(`status = 'past_due'`);
    assert.equal(await blocks(O), true);
    await asService(() => db.exec(`update public.venue_members set role = 'owner' where user_id = '${E}'`));
    assert.equal(await blocks(O), false);
  });
});

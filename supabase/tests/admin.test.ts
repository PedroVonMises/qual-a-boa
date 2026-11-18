import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { buildSeed } from '../seed/seed-data';
import { asRole, createDb, FIXED_NOW, type DB } from './harness';

// Back-office /admin (0024).
const ds = buildSeed(new Date(FIXED_NOW));
const MARE = ds.venues.find((v) => v.slug === 'casa-mare')!.id;
const BOLT = ds.venues.find((v) => v.slug === 'bolt')!.id;
const S = '00000000-0000-4000-8000-0000000000c1'; // staff
const O = '00000000-0000-4000-8000-0000000000c2'; // casa owner
const P = '00000000-0000-4000-8000-0000000000c3'; // owner of a proposed (new) casa
const U = '00000000-0000-4000-8000-0000000000c4'; // regular user
const Q = '00000000-0000-4000-8000-0000000000c5'; // owner of a proposal without coordinates

let db: DB;
let acc: string;

const as = <T>(user: string | null, fn: () => Promise<T>) => asRole(db, user ? 'authenticated' : 'anon', user, fn);
const asService = <T>(fn: () => Promise<T>) => asRole(db, 'service_role', null, fn);
const staff = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
  as(S, () => db.query<T>(sql, params)).then((r) => r.rows);
const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => (await staff<T>(sql, params))[0];
const log = () => asService(() => db.query<{ action: string; target_id: string; note: string | null; actor_id: string; details: Record<string, unknown> }>(
  `select action, target_id, note, actor_id, details from public.admin_actions order by created_at desc, id`)).then((r) => r.rows);

const startsAt = () => new Date(Date.now() + 10 * 86_400_000).toISOString();
const submit = (title: string) =>
  as(O, () => db.query<{ id: string }>(`select public.submit_event($1, $2::jsonb) as id`, [
    acc, JSON.stringify({ title, starts_at: startsAt(), is_free: true, dress_code: 'Livre' }),
  ])).then((r) => r.rows[0].id);

before(async () => {
  db = await createDb(ds);
  await db.exec(`insert into auth.users (id) values ('${S}'), ('${O}'), ('${P}'), ('${U}'), ('${Q}')`);
  await db.exec(`insert into public.profiles (id, display_name) values ('${S}', 'Equipe Bia')`);
  await asService(() => db.exec(`insert into public.staff_members (user_id) values ('${S}')`));
  acc = (await as(O, () =>
    db.query<{ id: string }>(`select public.claim_venue($1, null, '11222333000181', 'Casa Maré Ltda', 'Ana', '+5527999990000') as id`, [MARE]))).rows[0].id;
  await db.exec(`update public.venues set safety_protocol = null, safety_protocol_at = null`);
});
after(async () => { await db.close(); });

describe('staff membership (0024)', () => {
  test('only staff are staff; nobody joins the team or reads the log from a client', async () => {
    assert.equal((await as(S, () => db.query<{ s: boolean }>(`select public.is_staff() s`))).rows[0].s, true);
    assert.equal((await as(U, () => db.query<{ s: boolean }>(`select public.is_staff() s`))).rows[0].s, false);
    await as(U, async () => {
      await assert.rejects(db.query(`insert into public.staff_members (user_id) values ($1)`, [U]), /permission denied/);
      await assert.rejects(db.query(`select * from public.staff_members`), /permission denied/);
      await assert.rejects(db.query(`select * from public.admin_actions`), /permission denied/);
      await assert.rejects(db.query(`select public.admin_log('x_y_z', 'event', $1, null)`, [MARE]), /permission denied/);
    });
    await as(null, () => assert.rejects(db.query(`select public.is_staff()`), /permission denied/));
  });

  test('every admin function refuses non-staff', async () => {
    const calls = [
      `select * from public.admin_overview()`,
      `select * from public.admin_pending_events()`,
      `select * from public.admin_pending_accounts()`,
      `select * from public.admin_safety_queue()`,
      `select * from public.admin_hidden_posts()`,
      `select * from public.admin_safety_reports()`,
      `select * from public.admin_recent_actions()`,
      `select public.admin_review_event('${MARE}', true)`,
      `select public.admin_verify_event('${MARE}')`,
      `select public.admin_review_account('${acc}', true)`,
      `select public.admin_review_safety('${MARE}', 'verify')`,
      `select public.admin_moderate('thread', '${MARE}', 'restore')`,
      `select public.admin_reply_ticket('${MARE}', 'oi')`,
    ];
    for (const sql of calls) {
      await as(U, () => assert.rejects(db.query(sql), /not_staff/, sql));
      await as(O, () => assert.rejects(db.query(sql), /not_staff/, sql));
      await as(null, () => assert.rejects(db.query(sql), /permission denied/, sql));
    }
  });
});

describe('casas (0024)', () => {
  test('a claimed casa is verified from the queue and logged', async () => {
    const queue = await staff<{ id: string; venue_name: string; cnpj: string }>(`select * from public.admin_pending_accounts()`);
    assert.deepEqual(queue.map((a) => [a.id, a.venue_name, a.cnpj]), [[acc, 'Casa Maré', '11222333000181']]);
    assert.equal((await one<{ pending_accounts: number }>(`select * from public.admin_overview()`))!.pending_accounts, 1);
    assert.equal((await one<{ s: string }>(`select public.admin_review_account($1, true) s`, [acc]))!.s, 'verified');
    await as(S, () => assert.rejects(db.query(`select public.admin_review_account($1, true)`, [acc]), /not_pending/));
    const [l] = await log();
    assert.equal(l.action, 'account_verify');
    assert.equal(l.actor_id, S);
    assert.equal(l.details.venue_id, MARE);
    assert.equal(l.details.venue_created, false);
    await db.exec(`insert into public.subscriptions (venue_account_id, stripe_customer_id, status, current_period_start, current_period_end)
      values ('${acc}', 'cus_1', 'active', now(), now() + interval '60 days')`);
  });

  test('a proposed casa becomes a venue with a unique slug; without coordinates staff must link one', async () => {
    const prop = (await as(P, () => db.query<{ id: string }>(
      `select public.claim_venue(null, $1::jsonb, '11444777000161', 'Bolt Nova Ltda', 'Rui', '+5527988887777') as id`,
      [JSON.stringify({ name: 'Bolt', address: 'Rua Nova, 10', lat: -20.3, lng: -40.29, city: 'Vila Velha' })]))).rows[0].id;
    const noLoc = (await as(Q, () => db.query<{ id: string }>(
      `select public.claim_venue(null, $1::jsonb, '45997418000153', 'Sem Mapa Ltda', 'Lia', '+5527977776666') as id`,
      [JSON.stringify({ name: 'Sem Mapa', address: 'Rua X, 1' })]))).rows[0].id;
    await as(S, async () => {
      await assert.rejects(db.query(`select public.admin_review_account($1, false)`, [prop]), /note_required/);
      assert.equal((await db.query<{ s: string }>(`select public.admin_review_account($1, true) s`, [prop])).rows[0].s, 'verified');
      await assert.rejects(db.query(`select public.admin_review_account($1, true)`, [noLoc]), /venue_location_missing/);
      // Linking to a venue another live account holds is refused.
      await assert.rejects(db.query(`select public.admin_review_account($1, true, null, $2)`, [noLoc, MARE]), /venue_taken/);
    });
    const v = (await asService(() => db.query<{ slug: string; city: string; status: string; venue_id: string }>(
      `select v.slug, v.city, v.status, a.venue_id from public.venue_accounts a join public.venues v on v.id = a.venue_id where a.id = $1`,
      [prop]))).rows[0];
    assert.equal(v.slug, 'bolt-2');
    assert.equal(v.city, 'Vila Velha');
    assert.equal(v.status, 'open');
    assert.equal((await log())[0].details.venue_created, true);
    // Rejected with a reason the casa can read.
    assert.equal((await one<{ s: string }>(`select public.admin_review_account($1, false, 'CNPJ não confere') s`, [noLoc]))!.s, 'rejected');
    const r = (await as(Q, () => db.query<{ status: string; review_note: string }>(
      `select status, review_note from public.venue_accounts where id = $1`, [noLoc]))).rows[0];
    assert.deepEqual(r, { status: 'rejected', review_note: 'CNPJ não confere' });
    assert.equal((await log())[0].action, 'account_reject');
  });
});

describe('festas (0024)', () => {
  test('pending festas are listed, approved or refused with a reason, and logged', async () => {
    const a = await submit('Noite A');
    const b = await submit('Noite B');
    const queue = await staff<{ id: string; title: string; venue_name: string; account_name: string; dress_code: string }>(
      `select * from public.admin_pending_events()`);
    assert.deepEqual(queue.map((e) => e.title).sort(), ['Noite A', 'Noite B']);
    assert.equal(queue[0].venue_name, 'Casa Maré');
    assert.equal(queue[0].account_name, 'Casa Maré Ltda');
    assert.equal(queue[0].dress_code, 'Livre');
    assert.equal((await one<{ s: string }>(`select public.admin_review_event($1, true) s`, [a]))!.s, 'published');
    await as(S, () => assert.rejects(db.query(`select public.admin_review_event($1, false, ' ')`, [b]), /note_required/));
    assert.equal((await one<{ s: string }>(`select public.admin_review_event($1, false, 'Data errada') s`, [b]))!.s, 'rejected');
    assert.deepEqual(await staff(`select * from public.admin_pending_events()`), []);
    const [l2, l1] = await log();
    assert.deepEqual([l1.action, l1.target_id, l2.action, l2.note], ['event_approve', a, 'event_reject', 'Data errada']);
    assert.ok(await one(`select public.admin_verify_event($1)`, [a]));
    assert.equal((await log())[0].action, 'event_verify');
  });
});

describe('selo S1 (0024)', () => {
  test('declared and contested seals are queued; contest and reject need a reason', async () => {
    await as(O, () => db.query(`select public.declare_safety_protocol($1, 'Ana Souza')`, [acc]));
    let q = await staff<{ venue_id: string; state: string; responsible_name: string }>(`select * from public.admin_safety_queue()`);
    assert.deepEqual(q.map((x) => [x.venue_id, x.state, x.responsible_name]), [[MARE, 'declared', 'Ana Souza']]);
    await as(S, () => assert.rejects(db.query(`select public.admin_review_safety($1, 'contest')`, [MARE]), /note_required/));
    assert.equal((await one<{ s: string }>(`select public.admin_review_safety($1, 'verify') s`, [MARE]))!.s, 'verified');
    assert.deepEqual(await staff(`select * from public.admin_safety_queue()`), []);
    assert.equal((await one<{ s: string }>(`select public.admin_review_safety($1, 'contest', 'Relatos na semana') s`, [MARE]))!.s, 'contested');
    q = await staff(`select * from public.admin_safety_queue()`);
    assert.equal(q[0].state, 'contested');
    assert.equal((await log())[0].action, 'safety_contest');
  });
});

describe('moderação (0024)', () => {
  test('hidden posts are queued; restore clears their reports, keep_hidden only leaves the queue', async () => {
    const [t1, t2] = await asService(async () => {
      const ids: string[] = [];
      for (const title of ['Post 1', 'Post 2']) {
        ids.push((await db.query<{ id: string }>(
          `insert into public.threads (user_id, venue_id, kind, title, status, anonymous) values ($1, $2, 'vale_a_pena', $3, 'hidden', true) returning id`,
          [U, BOLT, title])).rows[0].id);
      }
      await db.query(`insert into public.community_reports (user_id, thread_id, reason) values ($1, $2, 'ofensivo')`, [O, ids[0]]);
      return ids;
    });
    const q = await staff<{ id: string; kind: string; report_count: number; reasons: string[] }>(`select * from public.admin_hidden_posts()`);
    assert.deepEqual(q.map((x) => [x.id, x.kind, x.report_count]), [[t1, 'thread', 1], [t2, 'thread', 0]]);
    assert.deepEqual(q[0].reasons, ['ofensivo']);
    await as(S, () => assert.rejects(db.query(`select public.admin_moderate('thread', $1, 'delete')`, [t1]), /invalid_payload/));
    assert.equal((await one<{ s: string }>(`select public.admin_moderate('thread', $1, 'restore') s`, [t1]))!.s, 'published');
    assert.equal((await one<{ s: string }>(`select public.admin_moderate('thread', $1, 'keep_hidden', 'Discurso de ódio') s`, [t2]))!.s, 'hidden');
    assert.deepEqual(await staff(`select * from public.admin_hidden_posts()`), []);
    await as(S, () => assert.rejects(db.query(`select public.admin_moderate('thread', $1, 'restore')`, [t1]), /post_not_hidden/));
    const st = (await asService(() => db.query<{ id: string; status: string }>(
      `select id, status from public.threads where id = any($1::uuid[]) order by title`, [[t1, t2]]))).rows;
    assert.deepEqual(st.map((x) => x.status), ['published', 'hidden']);
    const reports = (await asService(() => db.query<{ n: number }>(`select count(*)::int n from public.community_reports where thread_id = $1`, [t1]))).rows[0].n;
    assert.equal(reports, 0);
    const [l2, l1] = await log();
    assert.deepEqual([l1.action, l1.details, l2.action], ['post_restore', { reports_cleared: 1 }, 'post_keep_hidden']);
  });
});

describe('relatos de segurança (0024)', () => {
  test('open reports are listed without the reporter; staff answers in the ticket and may close it', async () => {
    const ticket = (await as(U, () => db.query<{ id: string }>(
      `select public.report_safety_incident($1, null, 'assedio', 'Um homem me seguiu até o banheiro.') id`, [BOLT]))).rows[0].id;
    const ov = (await one<{ open_safety_reports: number; oldest_safety_report_at: string }>(`select * from public.admin_overview()`))!;
    assert.equal(ov.open_safety_reports, 1);
    assert.ok(ov.oldest_safety_report_at);
    const [r] = await staff<Record<string, unknown>>(`select * from public.admin_safety_reports()`);
    assert.equal(r.ticket_id, ticket);
    assert.equal(r.venue_name, 'Bolt');
    assert.equal(r.kind, 'assedio');
    assert.equal(r.ticket_status, 'open');
    assert.ok(!('user_id' in r));
    await as(S, () => assert.rejects(db.query(`select public.admin_reply_ticket($1, ' ')`, [ticket]), /invalid_payload/));
    await as(S, () => assert.rejects(db.query(`select public.admin_reply_ticket($1, 'oi')`, [MARE]), /ticket_not_found/));
    assert.equal((await one<{ s: string }>(`select public.admin_reply_ticket($1, 'Sentimos muito. Estamos com você.') s`, [ticket]))!.s, 'answered');
    // The person sees the answer in Mensagens.
    const msgs = (await as(U, () => db.query<{ sender: string; text: string }>(
      `select sender, text from public.support_messages where ticket_id = $1`, [ticket]))).rows;
    assert.deepEqual(msgs, [{ sender: 'support', text: 'Sentimos muito. Estamos com você.' }]);
    assert.equal((await one<{ s: string }>(`select public.admin_reply_ticket($1, 'Caso encerrado.', true) s`, [ticket]))!.s, 'closed');
    assert.equal((await one<{ open_safety_reports: number }>(`select * from public.admin_overview()`))!.open_safety_reports, 0);
    const [l] = await log();
    assert.equal(l.action, 'ticket_close');
    assert.equal(l.note, null);
  });

  test('the log lists recent actions with the staff name', async () => {
    const rows = await staff<{ action: string; actor_name: string }>(`select * from public.admin_recent_actions(3)`);
    assert.equal(rows.length, 3);
    assert.equal(rows[0].action, 'ticket_close');
    assert.equal(rows[0].actor_name, 'Equipe Bia');
  });

  test('staff read festa posters and seal photos; others only what is public', async () => {
    const path = `${acc}/0d0d0d0d-0d0d-4d0d-8d0d-0d0d0d0d0d0d.jpg`;
    await asService(() => db.query(`insert into storage.objects (bucket_id, name) values ('event-posters', $1)`, [path]));
    const see = (u: string) => as(u, () => db.query(`select name from storage.objects where name = $1`, [path])).then((r) => r.rows.length);
    assert.equal(await see(S), 1);
    assert.equal(await see(U), 0);
  });
});

import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { buildSeed } from '../seed/seed-data';
import { asRole, createDb, FIXED_NOW, type DB } from './harness';

const ds = buildSeed(new Date(FIXED_NOW));
const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const published = ds.events.filter((e) => e.status === 'published');
const E1 = published[0].id;
const E2 = published[1].id;
const draft = ds.events.find((e) => e.status === 'draft')!;

let db: DB;
before(async () => {
  db = await createDb(ds);
  await db.exec(`insert into auth.users (id) values ('${A}'), ('${B}')`);
});
after(async () => { await db.close(); });

const asA = <T>(fn: () => Promise<T>) => asRole(db, 'authenticated', A, fn);
const asB = <T>(fn: () => Promise<T>) => asRole(db, 'authenticated', B, fn);
const count = async (sql: string, params: unknown[] = []) =>
  Number((await db.query<{ n: number }>(`select count(*)::int as n from (${sql}) s`, params)).rows[0].n);
const denied = (p: Promise<unknown>, re = /permission denied|row-level security|violates|requires/i) =>
  assert.rejects(p, re);

describe('anon cannot write', () => {
  const tables = ['event_follows', 'checkins', 'event_reports', 'reviews', 'review_votes',
    'support_tickets', 'support_messages'];
  for (const t of tables) {
    test(`${t}: insert denied`, async () => {
      await asRole(db, 'anon', null, async () => {
        await denied(db.query(`insert into public.${t} default values`), /permission denied|row-level security|null value|violates/i);
      });
    });
  }
  test('anon cannot read owner-only tables', async () => {
    await asRole(db, 'anon', null, async () => {
      for (const t of ['event_follows', 'checkins', 'review_votes', 'support_tickets', 'support_messages']) {
        await denied(db.query(`select * from public.${t}`), /permission denied/i);
      }
    });
  });
});

describe('follows / checkins owner isolation', () => {
  test('follows: A manages own, B sees none and cannot spoof', async () => {
    await asA(async () => {
      await db.query(`insert into public.event_follows (event_id, has_ticket) values ($1, true)`, [E1]);
      assert.equal(await count('select * from public.event_follows'), 1);
      await db.query(`update public.event_follows set alerts = alerts || '{"price":false}' where event_id = $1`, [E1]);
      await denied(db.query(`insert into public.event_follows (user_id, event_id) values ($1, $2)`, [B, E2]));
      await denied(db.query(`insert into public.event_follows (event_id) values ($1)`, [E1])); // duplicate pk
    });
    await asB(async () => {
      assert.equal(await count('select * from public.event_follows'), 0);
      const r = await db.query(`update public.event_follows set has_ticket = false`);
      assert.equal(r.affectedRows, 0);
      const d = await db.query(`delete from public.event_follows`);
      assert.equal(d.affectedRows, 0);
    });
    await asA(async () => {
      const r = await db.query<{ p: boolean }>(`select (alerts->>'price')::boolean p from public.event_follows`);
      assert.equal(r.rows[0].p, false);
    });
  });

  test('checkins: owner-only, published events only, server time', async () => {
    await asA(async () => {
      await db.query(`insert into public.checkins (event_id) values ($1)`, [E1]);
      assert.equal(await count('select * from public.checkins'), 1);
      await denied(db.query(`insert into public.checkins (event_id) values ($1)`, [draft.id]));
      await denied(db.query(`insert into public.checkins (event_id, user_id) values ($1, $2)`, [E1, B]));
      await denied(db.query(`insert into public.checkins (event_id, at) values ($1, now() - interval '30 days')`, [E1]));
    });
    await asB(async () => {
      assert.equal(await count('select * from public.checkins'), 0);
    });
  });
});

describe('live reports', () => {
  test('report requires a check-in for that event', async () => {
    await asB(async () => {
      await denied(db.query(`insert into public.event_reports (event_id, queue) values ($1, 'long')`, [E1]));
    });
    await asA(async () => {
      // A is checked in to E1 only.
      await db.query(`insert into public.event_reports (event_id, queue, crowd) values ($1, 'short', 'busy')`, [E1]);
      await denied(db.query(`insert into public.event_reports (event_id, queue) values ($1, 'long')`, [E2]));
      await denied(db.query(`insert into public.event_reports (event_id, user_id, queue) values ($1, $2, 'none')`, [E1, B]));
      await denied(db.query(`insert into public.event_reports (event_id) values ($1)`, [E1])); // no value
    });
  });

  test('stale check-in (>6h) does not allow reports', async () => {
    await db.exec(`insert into public.checkins (user_id, event_id, at) values
      ('${B}', '${E2}', now() - interval '7 hours')`);
    await asB(async () => {
      await denied(db.query(`insert into public.event_reports (event_id, music) values ($1, 'peak')`, [E2]));
    });
    await db.exec(`update public.checkins set at = now() - interval '5 hours' where user_id = '${B}'`);
    await asB(async () => {
      await db.query(`insert into public.event_reports (event_id, music) values ($1, 'peak')`, [E2]);
    });
  });

  test('public reads only rows newer than 24h; client cannot edit', async () => {
    await db.exec(`insert into public.event_reports (event_id, user_id, queue, created_at)
      values ('${E1}', '${A}', 'none', now() - interval '25 hours')`);
    await asRole(db, 'anon', null, async () => {
      assert.equal(await count('select * from public.event_reports where event_id = $1', [E1]), 1);
      await denied(db.query(`update public.event_reports set queue = 'long'`));
    });
    await asA(async () => {
      await denied(db.query(`update public.event_reports set queue = 'long'`));
      await denied(db.query(`delete from public.event_reports`));
    });
  });

  test('event_live_summary: latest per dimension, sample size, age', async () => {
    const ev = published[2].id;
    await db.exec(`insert into public.event_reports (event_id, user_id, created_at, queue, crowd, price_at_door) values
      ('${ev}', '${A}', now() - interval '3 hours', 'long', 'full', 50),
      ('${ev}', '${B}', now() - interval '1 hour', 'short', null, null),
      ('${ev}', '${A}', now() - interval '10 minutes', null, null, 60),
      ('${ev}', '${A}', now() - interval '30 hours', 'none', 'empty', 10)`);
    await asRole(db, 'anon', null, async () => {
      const { rows } = await db.query<any>(`select * from public.event_live_summary($1)`, [ev]);
      assert.equal(rows.length, 1);
      const r = rows[0];
      assert.equal(r.queue, 'short');
      assert.equal(r.crowd, 'full');
      assert.equal(r.music, null);
      assert.equal(Number(r.price_at_door), 60);
      assert.equal(r.sample_size, 3);
      assert.ok(r.age_seconds >= 590 && r.age_seconds <= 700, `age ${r.age_seconds}`);
    });
    await asRole(db, 'anon', null, async () => {
      const { rows } = await db.query<any>(`select * from public.event_live_summary($1)`, [draft.id]);
      assert.equal(rows[0].sample_size, 0);
      assert.equal(rows[0].queue, null);
      assert.equal(rows[0].age_seconds, null);
    });
  });
});

describe('reviews', () => {
  let reviewA: string;

  test('attended=true requires a check-in; one review per user per event', async () => {
    await asA(async () => {
      // A has check-in for E1 only.
      await denied(db.query(`insert into public.reviews (event_id, rating, attended) values ($1, 5, true)`, [E2]));
      const ok = await db.query<{ id: string }>(
        `insert into public.reviews (event_id, rating, attended, text) values ($1, 4, true, 'boa') returning id`, [E1]);
      reviewA = ok.rows[0].id;
      await denied(db.query(`insert into public.reviews (event_id, rating) values ($1, 3)`, [E1]), /duplicate|unique/i);
      // not attended is fine without check-in
      await db.query(`insert into public.reviews (event_id, rating, attended) values ($1, 3, false)`, [E2]);
      await denied(db.query(`insert into public.reviews (event_id, rating) values ($1, 6)`, [published[3].id]));
      // cannot self-publish or spoof owner
      await denied(db.query(`insert into public.reviews (event_id, rating, status) values ($1, 5, 'published')`, [published[3].id]));
      await denied(db.query(`insert into public.reviews (event_id, user_id, rating) values ($1, $2, 5)`, [published[3].id, B]));
      await denied(db.query(`update public.reviews set status = 'published'`));
      await denied(db.query(`update public.reviews set attended = true where event_id = $1`, [E2]));
    });
  });

  test('trigger blocks attended without check-in even for privileged writers', async () => {
    await assert.rejects(
      db.query(`insert into public.reviews (user_id, event_id, rating, attended) values ($1, $2, 5, true)`, [B, published[4].id]),
      /requires a check-in/);
  });

  test('visibility: pending is owner-only, published is public; user_id hidden', async () => {
    await asA(async () => {
      assert.equal(await count('select id from public.reviews'), 2);
      await denied(db.query('select user_id from public.reviews'), /permission denied/i);
    });
    await asB(async () => assert.equal(await count('select id from public.reviews'), 0));
    await asRole(db, 'anon', null, async () => assert.equal(await count('select id from public.reviews'), 0));

    await db.exec(`update public.reviews set status = 'published' where id = '${reviewA}'`);
    await asRole(db, 'anon', null, async () => {
      assert.equal(await count('select id from public.reviews'), 1);
      const { rows } = await db.query<any>('select id, mine from public.reviews_feed');
      assert.equal(rows.length, 1);
      assert.equal(rows[0].mine, false);
    });
    await asB(async () => assert.equal(await count('select id from public.reviews'), 1));
    await asA(async () => {
      const { rows } = await db.query<any>('select id, mine, status from public.reviews_feed order by mine desc');
      assert.equal(rows.length, 2); // published + own pending
      assert.equal(rows[0].mine, true);
    });
    await db.exec(`update public.reviews set status = 'hidden' where id = '${reviewA}'`);
    await asRole(db, 'anon', null, async () => assert.equal(await count('select id from public.reviews'), 0));
    await db.exec(`update public.reviews set status = 'published' where id = '${reviewA}'`);
  });

  test('helpful votes: one per user per review, counter follows', async () => {
    await asB(async () => {
      await db.query(`insert into public.review_votes (review_id) values ($1)`, [reviewA]);
      await denied(db.query(`insert into public.review_votes (review_id) values ($1)`, [reviewA]), /duplicate|unique/i);
      await denied(db.query(`insert into public.review_votes (review_id, user_id) values ($1, $2)`, [reviewA, A]));
      assert.equal(await count('select * from public.review_votes'), 1);
    });
    await asA(async () => {
      assert.equal(await count('select * from public.review_votes'), 0); // isolation
      const { rows } = await db.query<any>('select helpful_count from public.reviews where id = $1', [reviewA]);
      assert.equal(rows[0].helpful_count, 1);
      await denied(db.query(`update public.reviews set helpful_count = 99`));
    });
    await asB(async () => {
      await db.query(`delete from public.review_votes where review_id = $1`, [reviewA]);
    });
    const { rows } = await db.query<any>('select helpful_count from public.reviews where id = $1', [reviewA]);
    assert.equal(rows[0].helpful_count, 0);
  });

  test('cannot vote on a review you cannot see', async () => {
    await asB(async () => {
      const hidden = await db.query<any>(`select id from public.reviews`);
      assert.equal(hidden.rows.length, 1); // only reviewA published
    });
    await db.exec(`update public.reviews set status = 'pending' where id = '${reviewA}'`);
    await asB(async () => {
      await denied(db.query(`insert into public.review_votes (review_id) values ($1)`, [reviewA]));
    });
  });
});

describe('support', () => {
  let ticketA: string;

  test('tickets are owner-only', async () => {
    await asA(async () => {
      const r = await db.query<{ id: string }>(
        `insert into public.support_tickets (topic, description, event_id) values ('ingresso', 'Ajuda', $1) returning id`, [E1]);
      ticketA = r.rows[0].id;
      await denied(db.query(`insert into public.support_tickets (topic, description) values ('bogus', 'x')`));
      await denied(db.query(`insert into public.support_tickets (user_id, topic, description) values ($1, 'outro', 'x')`, [B]));
      await denied(db.query(`insert into public.support_tickets (topic, description, status) values ('outro', 'x', 'answered')`));
      await denied(db.query(`update public.support_tickets set status = 'answered'`));
      await db.query(`update public.support_tickets set status = 'closed' where id = $1`, [ticketA]);
    });
    await asB(async () => {
      assert.equal(await count('select * from public.support_tickets'), 0);
      assert.equal((await db.query(`update public.support_tickets set status = 'closed'`)).affectedRows, 0);
      assert.equal((await db.query(`delete from public.support_tickets`)).affectedRows, 0);
    });
  });

  test('messages: own tickets only, sender spoof rejected', async () => {
    await asA(async () => {
      await db.query(`insert into public.support_messages (ticket_id, sender, text) values ($1, 'user', 'oi')`, [ticketA]);
      await denied(db.query(`insert into public.support_messages (ticket_id, sender, text) values ($1, 'support', 'fake')`, [ticketA]));
      await denied(db.query(`insert into public.support_messages (ticket_id, text) values ($1, 'x')`, [ticketA]).then(() => {
        throw new Error('default sender must not exist'); // sender is NOT NULL without default
      }), /default sender|null value|violates/i);
    });
    await asB(async () => {
      await denied(db.query(`insert into public.support_messages (ticket_id, sender, text) values ($1, 'user', 'intruso')`, [ticketA]));
      assert.equal(await count('select * from public.support_messages'), 0);
    });
    await db.exec(`insert into public.support_messages (ticket_id, sender, text) values ('${ticketA}', 'support', 'Olá')`);
    await asA(async () => {
      assert.equal(await count('select * from public.support_messages'), 2);
      await db.query(`update public.support_messages set read_at = now() where sender = 'support'`);
      await denied(db.query(`update public.support_messages set text = 'edit'`));
    });
  });
});

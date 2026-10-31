import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { buildSeed } from '../seed/seed-data';
import { asRole, createDb, FIXED_NOW, type DB } from './harness';

const ds = buildSeed(new Date(FIXED_NOW));
const U = (c: string) => `00000000-0000-4000-8000-0000000000${c}`;
const [A, B, C, D, E] = ['0a', '0b', '0c', '0d', '0e'].map(U);
const published = ds.events.filter((e) => e.status === 'published');
const E1 = published[0].id;
const E_ENDED = published[1].id;
const draft = ds.events.find((e) => e.status === 'draft')!;
const VENUE = ds.venues[0].id;

let db: DB;
before(async () => {
  db = await createDb(ds);
  await db.exec(`insert into auth.users (id) values ${[A, B, C, D, E].map((u) => `('${u}')`).join(',')}`);
  await db.exec(`insert into public.profiles (id, handle, avatar_hue) values
    ('${A}', 'ana_vix', 20), ('${B}', 'bia.vv', 200), ('${C}', 'caio', 300), ('${D}', 'dani', 40)`); // E has no handle
  await db.exec(`update public.events set starts_at = now() - interval '1 hour', ends_at = now() + interval '5 hours'
    where id = '${E1}'`);
  await db.exec(`update public.events set starts_at = now() - interval '10 hours', ends_at = now() - interval '5 hours'
    where id = '${E_ENDED}'`);
});
after(async () => { await db.close(); });

const as = (u: string) => <T>(fn: () => Promise<T>) => asRole(db, 'authenticated', u, fn);
const asA = as(A), asB = as(B), asC = as(C), asD = as(D), asE = as(E);
const asAnon = <T>(fn: () => Promise<T>) => asRole(db, 'anon', null, fn);
const denied = (p: Promise<unknown>, re = /permission denied|row-level security|violates|required|nested|belong/i) =>
  assert.rejects(p, re);

async function newThread(who: typeof asA, over: { event?: string; anonymous?: boolean; kind?: string } = {}) {
  return who(async () => {
    const r = await db.query<{ id: string }>(
      `insert into public.threads (event_id, kind, title, anonymous) values ($1, $2, 'Vale a pena?', $3) returning id`,
      [over.event ?? E1, over.kind ?? 'vale_a_pena', over.anonymous ?? false],
    );
    return r.rows[0].id;
  });
}
async function newComment(who: typeof asA, thread: string, parent: string | null = null, anonymous = false) {
  return who(async () => {
    const r = await db.query<{ id: string }>(
      `insert into public.comments (thread_id, parent_id, body, anonymous) values ($1, $2, 'A pista resolve.', $3) returning id`,
      [thread, parent, anonymous],
    );
    return r.rows[0].id;
  });
}
const feedThread = (who: typeof asA | typeof asAnon, id: string) =>
  who(async () => (await db.query<Record<string, unknown>>(`select * from public.threads_feed where id = $1`, [id])).rows[0]);
const votes = async (cid: string) =>
  Number((await db.query<{ n: number }>(`select helpful_count n from public.comments where id = $1`, [cid])).rows[0].n);

describe('anon cannot write or read private tables', () => {
  for (const t of ['threads', 'comments', 'comment_votes', 'community_reports']) {
    test(`${t}: insert denied`, async () => {
      await asAnon(() => denied(db.query(`insert into public.${t} default values`), /permission denied|row-level|null value|violates/i));
    });
  }
  test('votes and reports are not readable', async () => {
    await asAnon(async () => {
      await denied(db.query(`select * from public.comment_votes`), /permission denied/i);
      await denied(db.query(`select * from public.community_reports`), /permission denied/i);
    });
  });
});

describe('handle and anonymity', () => {
  test('profile handle must match the pattern and be unique', async () => {
    await denied(db.query(`update public.profiles set handle = 'Ab' where id = '${D}'`), /violates check/i);
    await denied(db.query(`update public.profiles set handle = 'has space' where id = '${D}'`), /violates check/i);
    await denied(db.query(`update public.profiles set handle = 'ana_vix' where id = '${D}'`), /unique|duplicate/i);
  });

  test('posting by name needs a handle; anonymous does not', async () => {
    await denied(newThread(asE, { anonymous: false }), /handle is required/i);
    await assert.doesNotReject(newThread(asE, { anonymous: true }));
    await denied(
      asE(async () => { await db.query(`insert into public.comments (thread_id, body) values ((select id from public.threads limit 1), 'oi')`); }),
      /handle is required/i,
    );
  });

  test('feed shows the handle only for named posts; user_id is never selectable', async () => {
    const named = await newThread(asA);
    const anon = await newThread(asA, { anonymous: true });
    const n = await feedThread(asAnon, named);
    const a = await feedThread(asAnon, anon);
    assert.equal(n.handle, 'ana_vix');
    assert.equal(n.avatar_hue, 20);
    assert.equal(a.handle, null);
    assert.equal(a.avatar_hue, null);
    await asAnon(() => denied(db.query(`select user_id from public.threads`), /permission denied/i));
    await asB(() => denied(db.query(`select user_id from public.comments`), /permission denied/i));
  });

  test('mine is true only for the author', async () => {
    const t = await newThread(asA, { anonymous: true });
    assert.equal((await feedThread(asA, t)).mine, true);
    assert.equal((await feedThread(asB, t)).mine, false);
    assert.equal((await feedThread(asAnon, t)).mine, false);
  });
});

describe('threads', () => {
  test('need exactly one of event or venue', async () => {
    await asA(async () => {
      await denied(db.query(`insert into public.threads (kind, title) values ('grupo', 'x')`), /threads_one_scope/i);
      await denied(
        db.query(`insert into public.threads (event_id, venue_id, kind, title) values ($1, $2, 'grupo', 'x')`, [E1, VENUE]),
        /threads_one_scope/i,
      );
      const r = await db.query(`insert into public.threads (venue_id, kind, title) values ($1, 'grupo', 'x') returning id`, [VENUE]);
      assert.equal(r.rows.length, 1);
    });
  });

  test('cannot be posted on an unpublished event', async () => {
    await denied(newThread(asA, { event: draft.id }));
  });

  test('title is required and capped', async () => {
    await asA(async () => {
      await denied(db.query(`insert into public.threads (event_id, kind, title) values ($1, 'grupo', '   ')`, [E1]), /violates check/i);
      await denied(db.query(`insert into public.threads (event_id, kind, title) values ($1, 'grupo', $2)`, [E1, 'x'.repeat(121)]), /violates check/i);
    });
  });

  test('agora threads of an ended event are archived; others are not', async () => {
    const ended = await newThread(asA, { event: E_ENDED, kind: 'agora' });
    const live = await newThread(asA, { kind: 'agora' });
    const worth = await newThread(asA, { event: E_ENDED, kind: 'vale_a_pena' });
    assert.equal((await feedThread(asAnon, ended)).archived, true);
    assert.equal((await feedThread(asAnon, live)).archived, false);
    assert.equal((await feedThread(asAnon, worth)).archived, false);
  });

  test('content cannot be edited by clients', async () => {
    const t = await newThread(asA);
    await asA(() => denied(db.query(`update public.threads set title = 'novo' where id = $1`, [t]), /permission denied/i));
  });
});

describe('comments', () => {
  test('replies are capped at one level and stay in their thread', async () => {
    const t1 = await newThread(asA);
    const t2 = await newThread(asA);
    const top = await newComment(asB, t1);
    const reply = await newComment(asC, t1, top);
    await denied(newComment(asD, t1, reply), /nested/i);
    await denied(newComment(asD, t2, top), /same thread/i);
  });

  test('comment_count counts published comments only', async () => {
    const t = await newThread(asA);
    await newComment(asB, t);
    await newComment(asC, t);
    assert.equal((await feedThread(asAnon, t)).comment_count, 2);
  });

  test('anonymous comments hide the handle in comments_feed', async () => {
    const t = await newThread(asA);
    const c = await newComment(asB, t, null, true);
    const row = await asAnon(async () => (await db.query<Record<string, unknown>>(`select * from public.comments_feed where id = $1`, [c])).rows[0]);
    assert.equal(row.handle, null);
    assert.equal(row.anonymous, true);
  });

  test('deleting a thread removes its comments', async () => {
    const t = await newThread(asA);
    const c = await newComment(asB, t);
    await asA(() => db.query(`delete from public.threads where id = $1`, [t]));
    assert.equal((await db.query(`select 1 from public.comments where id = $1`, [c])).rows.length, 0);
  });
});

describe('helpful votes and the Mais útil pin', () => {
  test('one vote per user, counted by trigger, removable', async () => {
    const t = await newThread(asA);
    const c = await newComment(asB, t);
    await asC(() => db.query(`insert into public.comment_votes (comment_id) values ($1)`, [c]));
    assert.equal(await votes(c), 1);
    await asC(() => denied(db.query(`insert into public.comment_votes (comment_id) values ($1)`, [c]), /duplicate|unique/i));
    await asC(() => db.query(`delete from public.comment_votes where comment_id = $1`, [c]));
    assert.equal(await votes(c), 0);
  });

  test('cannot vote on your own comment', async () => {
    const t = await newThread(asA);
    const c = await newComment(asB, t);
    await asB(() => denied(db.query(`insert into public.comment_votes (comment_id) values ($1)`, [c])));
  });

  test('voted reflects the caller only', async () => {
    const t = await newThread(asA);
    const c = await newComment(asB, t);
    await asC(() => db.query(`insert into public.comment_votes (comment_id) values ($1)`, [c]));
    const seen = (who: typeof asA) => who(async () => (await db.query<{ voted: boolean }>(`select voted from public.comments_feed where id = $1`, [c])).rows[0].voted);
    assert.equal(await seen(asC), true);
    assert.equal(await seen(asD), false);
  });

  test('top comment appears only at 3 votes; the most helpful wins, ties go to the newest', async () => {
    const t = await newThread(asA);
    const low = await newComment(asB, t);
    const high = await newComment(asC, t);
    const reply = await newComment(asD, t, high);
    const vote = (who: typeof asA, id: string) => who(() => db.query(`insert into public.comment_votes (comment_id) values ($1)`, [id]));

    await vote(asA, high);
    await vote(asD, high);
    assert.equal((await feedThread(asAnon, t)).top_comment_id, null, 'two votes is below the threshold');

    await vote(asB, high);
    let row = await feedThread(asAnon, t);
    assert.equal(row.top_comment_id, high);
    assert.equal(row.top_comment_votes, 3);
    assert.equal(row.top_comment_body, 'A pista resolve.');

    // Replies never become the pin, even with more votes.
    for (const w of [asA, asB, asC]) await vote(w, reply);
    await vote(asE, reply);
    row = await feedThread(asAnon, t);
    assert.equal(row.top_comment_id, high);

    // A tie at 3 goes to the newest top-level comment (`high` was posted after `low`).
    for (const w of [asA, asC, asD]) await vote(w, low);
    row = await feedThread(asAnon, t);
    assert.equal(row.top_comment_id, high);

    // A higher count beats recency.
    await vote(asE, low);
    row = await feedThread(asAnon, t);
    assert.equal(row.top_comment_id, low);
    assert.equal(row.top_comment_votes, 4);
  });
});

describe('reports and auto-hide', () => {
  test('cannot report your own content or the same target twice', async () => {
    const t = await newThread(asA);
    const c = await newComment(asB, t);
    await asB(() => denied(db.query(`insert into public.community_reports (comment_id, reason) values ($1, 'spam')`, [c])));
    await asC(() => db.query(`insert into public.community_reports (comment_id, reason) values ($1, 'spam')`, [c]));
    await asC(() => denied(db.query(`insert into public.community_reports (comment_id, reason) values ($1, 'spam')`, [c]), /duplicate|unique/i));
    await asA(() => denied(db.query(`insert into public.community_reports (thread_id, reason) values ($1, 'spam')`, [t])));
  });

  test('a report needs exactly one target', async () => {
    // Rejected either by the RLS policy (needs a target) or by the one-target check.
    await asC(() => denied(db.query(`insert into public.community_reports (reason) values ('spam')`), /row-level|one_target/i));
  });

  test('3 distinct reporters hide a comment: gone for others, still visible (as hidden) to its author', async () => {
    const t = await newThread(asA);
    const c = await newComment(asB, t);
    for (const w of [asC, asD, asA]) {
      await w(() => db.query(`insert into public.community_reports (comment_id, reason) values ($1, 'ofensivo')`, [c]));
    }
    const seen = (who: typeof asA | typeof asAnon) => who(async () => (await db.query<{ status: string }>(`select status from public.comments_feed where id = $1`, [c])).rows);
    assert.equal((await seen(asAnon)).length, 0);
    assert.equal((await seen(asC)).length, 0);
    const own = await seen(asB);
    assert.equal(own.length, 1);
    assert.equal(own[0].status, 'hidden');
  });

  test('2 reports are not enough; 3 hide a thread together with its comments', async () => {
    const t = await newThread(asA);
    const c = await newComment(asB, t);
    for (const w of [asC, asD]) await w(() => db.query(`insert into public.community_reports (thread_id, reason) values ($1, 'spam')`, [t]));
    assert.ok(await feedThread(asAnon, t));
    await asB(() => db.query(`insert into public.community_reports (thread_id, reason) values ($1, 'spam')`, [t]));
    assert.equal(await feedThread(asAnon, t), undefined);
    assert.equal((await feedThread(asA, t)).status, 'hidden');
    const comments = await asAnon(async () => (await db.query(`select 1 from public.comments_feed where id = $1`, [c])).rows);
    assert.equal(comments.length, 0);
  });

  test('reports are private to the reporter', async () => {
    const t = await newThread(asA);
    await asC(() => db.query(`insert into public.community_reports (thread_id, reason) values ($1, 'spam')`, [t]));
    const seen = (who: typeof asA) => who(async () => (await db.query(`select 1 from public.community_reports where thread_id = $1`, [t])).rows.length);
    assert.equal(await seen(asC), 1);
    assert.equal(await seen(asD), 0);
  });
});

describe('replies follow their parent', () => {
  test('a hidden parent takes its replies out of the feed and the reply count', async () => {
    const t = await newThread(asA);
    const parent = await newComment(asB, t);
    const reply = await newComment(asC, t, parent);
    const sibling = await newComment(asD, t);
    assert.equal((await feedThread(asAnon, t)).comment_count, 3);

    for (const w of [asC, asD, asA]) {
      await w(() => db.query(`insert into public.community_reports (comment_id, reason) values ($1, 'ofensivo')`, [parent]));
    }
    const ids = (who: typeof asA | typeof asAnon) =>
      who(async () => (await db.query<{ id: string }>(`select id from public.comments_feed where thread_id = $1 order by created_at`, [t])).rows.map((r) => r.id));

    assert.deepEqual(await ids(asAnon), [sibling], 'parent and its reply are gone for others');
    assert.equal((await feedThread(asAnon, t)).comment_count, 1);
    // The reply's own author still sees their reply; the hidden parent's author still sees theirs.
    assert.deepEqual(await ids(asC), [reply, sibling]);
    assert.deepEqual(await ids(asB), [parent, sibling]);
  });

  test('a published parent keeps its replies visible', async () => {
    const t = await newThread(asA);
    const parent = await newComment(asB, t);
    const reply = await newComment(asC, t, parent);
    const seen = await asAnon(async () => (await db.query<{ id: string }>(`select id from public.comments_feed where thread_id = $1`, [t])).rows.map((r) => r.id));
    assert.deepEqual(seen.sort(), [parent, reply].sort());
    assert.equal((await feedThread(asAnon, t)).comment_count, 2);
  });
});

describe('account deletion', () => {
  test('deleting the auth user removes their threads, comments and votes', async () => {
    const t = await newThread(asD);
    const c = await newComment(asD, t);
    await asC(() => db.query(`insert into public.comment_votes (comment_id) values ($1)`, [c]));
    await db.exec(`delete from auth.users where id = '${D}'`);
    assert.equal((await db.query(`select 1 from public.threads where id = '${t}'`)).rows.length, 0);
    assert.equal((await db.query(`select 1 from public.comments where id = '${c}'`)).rows.length, 0);
    assert.equal((await db.query(`select 1 from public.comment_votes where comment_id = '${c}'`)).rows.length, 0);
  });
});

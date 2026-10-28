import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, test } from 'node:test';

import { buildSeed } from '../seed/seed-data';
import { asRole, createDb, FIXED_NOW, type DB } from './harness';

const ds = buildSeed(new Date(FIXED_NOW));
const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const E1 = ds.events.filter((e) => e.status === 'published')[0].id;

let db: DB;
let reviewA: string;
let ticketA: string;
let ticketB: string;
let messageB: string;

before(async () => {
  db = await createDb(ds);
  await db.exec(`insert into auth.users (id) values ('${A}'), ('${B}')`);
  // Reviews of events that already started are allowed without a check-in.
  await db.exec(`update public.events set starts_at = now() - interval '10 hours', ends_at = now() - interval '5 hours' where id = '${E1}'`);
  reviewA = (await asA(() => db.query<{ id: string }>(
    `insert into public.reviews (event_id, rating) values ($1, 4) returning id`, [E1]))).rows[0].id;
  ticketA = (await asA(() => db.query<{ id: string }>(
    `insert into public.support_tickets (topic, description) values ('outro', 'foto do problema') returning id`))).rows[0].id;
  ticketB = (await asB(() => db.query<{ id: string }>(
    `insert into public.support_tickets (topic, description) values ('outro', 'outro chamado') returning id`))).rows[0].id;
  messageB = (await asB(() => db.query<{ id: string }>(
    `insert into public.support_messages (ticket_id, sender, text) values ($1, 'user', 'oi') returning id`, [ticketB]))).rows[0].id;
});
after(async () => { await db.close(); });

const asA = <T>(fn: () => Promise<T>) => asRole(db, 'authenticated', A, fn);
const asB = <T>(fn: () => Promise<T>) => asRole(db, 'authenticated', B, fn);
const anon = <T>(fn: () => Promise<T>) => asRole(db, 'anon', null, fn);
const count = async (sql: string, params: unknown[] = []) =>
  Number((await db.query<{ n: number }>(`select count(*)::int as n from (${sql}) s`, params)).rows[0].n);
const denied = (p: Promise<unknown>, re = /permission denied|row-level security|violates|at most/i) => assert.rejects(p, re);
const pathFor = (user: string, ext = 'jpg') => `${user}/${randomUUID()}.${ext}`;
const addReviewPhoto = (path: string, review = reviewA) =>
  db.query(`insert into public.review_photos (review_id, path) values ($1, $2)`, [review, path]);
const reviewStatus = async () =>
  (await db.query<{ status: string }>(`select status from public.reviews where id = $1`, [reviewA])).rows[0].status;
const putObject = (bucket: string, name: string) =>
  db.query(`insert into storage.objects (bucket_id, name) values ($1, $2)`, [bucket, name]);

describe('buckets', () => {
  test('both are private, 5 MB, images only', async () => {
    const r = await db.query<{ id: string; public: boolean; file_size_limit: string; allowed_mime_types: string[] }>(
      `select id, public, file_size_limit, allowed_mime_types from storage.buckets order by id`);
    assert.deepEqual(r.rows.map((b) => b.id), ['review-photos', 'support-attachments']);
    for (const b of r.rows) {
      assert.equal(b.public, false);
      assert.equal(Number(b.file_size_limit), 5 * 1024 * 1024);
      assert.deepEqual(b.allowed_mime_types, ['image/jpeg', 'image/png', 'image/webp']);
    }
  });
});

describe('review_photos', () => {
  const ownPath = pathFor(A);

  test('anon cannot write', async () => {
    await anon(() => denied(addReviewPhoto(pathFor(A))));
  });

  test('owner can attach a photo to their own review', async () => {
    await asA(async () => { await addReviewPhoto(ownPath); });
    await asA(async () => assert.equal(await count('select id from public.review_photos'), 1));
  });

  test('other users cannot attach to someone else\'s review', async () => {
    await asB(() => denied(addReviewPhoto(pathFor(B))));
  });

  test('path must be inside the uploader\'s own folder and well formed', async () => {
    await asA(async () => {
      await denied(addReviewPhoto(pathFor(B)), /violates|row-level security/i);
      await denied(addReviewPhoto(`${A}/not-a-uuid.jpg`), /violates/i);
      await denied(addReviewPhoto(pathFor(A, 'gif')), /violates/i);
      await denied(addReviewPhoto(`${A}/../${randomUUID()}.jpg`), /violates/i);
      await denied(db.query(`insert into public.review_photos (review_id, user_id, path) values ($1, $2, $3)`,
        [reviewA, B, pathFor(B)]), /violates|row-level security/i);
    });
  });

  test('a pending review\'s photos are private to the owner', async () => {
    assert.equal(await reviewStatus(), 'pending');
    await anon(async () => assert.equal(await count('select id from public.review_photos'), 0));
    await asB(async () => assert.equal(await count('select id from public.review_photos'), 0));
    await asA(async () => assert.equal(await count('select id from public.review_photos'), 1));
  });

  test('at most 3 photos per review', async () => {
    await asA(async () => {
      await addReviewPhoto(pathFor(A));
      await addReviewPhoto(pathFor(A));
      await denied(addReviewPhoto(pathFor(A)), /at most 3/i);
    });
  });

  test('once published, everyone sees the photo but never who uploaded it', async () => {
    await db.exec(`update public.reviews set status = 'published' where id = '${reviewA}'`);
    for (const who of [anon, asB]) {
      await who(async () => {
        assert.equal(await count('select id from public.review_photos'), 3);
        await denied(db.query('select user_id from public.review_photos'), /permission denied/i);
        assert.equal(await count('select id, review_id, path, created_at from public.review_photos'), 3);
      });
    }
  });

  test('only the owner can delete a photo', async () => {
    await asB(async () => {
      await db.query(`delete from public.review_photos`);
      assert.equal(await count('select id from public.review_photos'), 3);
    });
    await asA(async () => {
      await db.query(`delete from public.review_photos where path = $1`, [ownPath]);
    });
    await asA(async () => assert.equal(await count('select id from public.review_photos'), 2));
  });

  test('adding a photo to a published review sends it back to moderation', async () => {
    assert.equal(await reviewStatus(), 'published');
    await asA(async () => { await addReviewPhoto(pathFor(A)); });
    assert.equal(await reviewStatus(), 'pending');
    await anon(async () => assert.equal(await count('select id from public.review_photos'), 0));
  });

  test('helpers are not callable by anon', async () => {
    await anon(() => denied(db.query(`select public.owns_review($1)`, [reviewA]), /permission denied/i));
    await asA(async () => assert.equal((await db.query<{ o: boolean }>(`select public.owns_review($1) o`, [reviewA])).rows[0].o, true));
    await asB(async () => assert.equal((await db.query<{ o: boolean }>(`select public.owns_review($1) o`, [reviewA])).rows[0].o, false));
    await asA(() => denied(db.query(`select public.review_photos_limit()`), /permission denied/i));
  });
});

describe('support_attachments', () => {
  const pathA = pathFor(A, 'png');
  const attach = (ticket: string, path: string, message: string | null = null) =>
    db.query(`insert into public.support_attachments (ticket_id, message_id, path) values ($1, $2, $3)`, [ticket, message, path]);

  test('anon cannot read or write', async () => {
    await anon(async () => {
      await denied(attach(ticketA, pathFor(A)));
      await denied(db.query('select * from public.support_attachments'), /permission denied/i);
    });
  });

  test('owner attaches to their own ticket', async () => {
    await asA(async () => { await attach(ticketA, pathA); });
    await asA(async () => assert.equal(await count('select id from public.support_attachments'), 1));
  });

  test('other users cannot see it or attach to the ticket', async () => {
    await asB(async () => {
      assert.equal(await count('select id from public.support_attachments'), 0);
      await denied(attach(ticketA, pathFor(B)));
    });
  });

  test('message must belong to the same ticket', async () => {
    await asA(() => denied(attach(ticketA, pathFor(A), messageB)));
    await asB(async () => { await attach(ticketB, pathFor(B), messageB); });
  });

  test('at most 5 attachments per ticket', async () => {
    await asA(async () => {
      for (let i = 0; i < 4; i++) await attach(ticketA, pathFor(A));
      await denied(attach(ticketA, pathFor(A)), /at most 5/i);
    });
  });

  test('only the owner can delete', async () => {
    await asB(async () => {
      await db.query(`delete from public.support_attachments where ticket_id = $1`, [ticketA]);
    });
    await asA(async () => assert.equal(await count('select id from public.support_attachments where ticket_id = $1', [ticketA]), 5));
    await asA(async () => {
      await db.query(`delete from public.support_attachments where path = $1`, [pathA]);
    });
    await asA(async () => assert.equal(await count('select id from public.support_attachments where ticket_id = $1', [ticketA]), 4));
  });
});

describe('storage objects', () => {
  test('uploads are limited to your own folder', async () => {
    await asA(async () => {
      await putObject('review-photos', pathFor(A));
      await putObject('support-attachments', pathFor(A));
      await denied(putObject('review-photos', pathFor(B)));
      await denied(putObject('support-attachments', pathFor(B)));
      await denied(putObject('other-bucket', pathFor(A)), /violates|row-level security|foreign key/i);
    });
    await anon(() => denied(putObject('review-photos', pathFor(A))));
  });

  test('support attachments are readable only by their owner', async () => {
    await asA(async () => assert.equal(await count(`select id from storage.objects where bucket_id = 'support-attachments'`), 1));
    await asB(async () => assert.equal(await count(`select id from storage.objects where bucket_id = 'support-attachments'`), 0));
    await anon(async () => assert.equal(await count(`select id from storage.objects where bucket_id = 'support-attachments'`), 0));
  });

  test('review photo files are public only while linked to a visible review photo', async () => {
    const linked = pathFor(A);
    const unlinked = pathFor(A);
    await asA(async () => { await putObject('review-photos', linked); await putObject('review-photos', unlinked); });
    await db.exec(`update public.reviews set status = 'published' where id = '${reviewA}'`);
    await asA(async () => { await db.query(`delete from public.review_photos`); await addReviewPhoto(linked); });
    await db.exec(`update public.reviews set status = 'published' where id = '${reviewA}'`);

    const visible = async () => (await db.query<{ name: string }>(
      `select name from storage.objects where bucket_id = 'review-photos' and name = any($1::text[])`, [[linked, unlinked]])).rows.map((r) => r.name);
    await anon(async () => assert.deepEqual(await visible(), [linked]));
    await asB(async () => assert.deepEqual(await visible(), [linked]));
    await asA(async () => assert.deepEqual((await visible()).sort(), [linked, unlinked].sort()));

    // Back in moderation: the file stops being public, the owner keeps it.
    await db.exec(`update public.reviews set status = 'pending' where id = '${reviewA}'`);
    await anon(async () => assert.deepEqual(await visible(), []));
    await asA(async () => assert.equal((await visible()).length, 2));
  });

  test('only the owner can delete their files; nobody can overwrite', async () => {
    const p = pathFor(A);
    await asA(async () => { await putObject('review-photos', p); });
    await asB(async () => {
      await db.query(`delete from storage.objects where name = $1`, [p]);
      await denied(db.query(`update storage.objects set name = name where name = $1`, [p]), /permission denied/i);
    });
    await asA(async () => assert.equal(await count('select id from storage.objects where name = $1', [p]), 1));
    await asA(async () => { await db.query(`delete from storage.objects where name = $1`, [p]); });
    await asA(async () => assert.equal(await count('select id from storage.objects where name = $1', [p]), 0));
  });
});

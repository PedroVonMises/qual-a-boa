import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { BUCKETS, deleteAccount, type Deps } from '../functions/delete-account/handler';

const U = '00000000-0000-4000-8000-00000000000a';

/** Records every dependency call in order so tests can assert on sequencing. */
function fake(over: Partial<Deps> & { files?: Record<string, string[][]> } = {}) {
  const log: string[] = [];
  const pages = structuredClone(over.files ?? { 'review-photos': [['p1.jpg', 'p2.jpg']], 'support-attachments': [['a1.png']] });
  const deps: Deps = {
    getUser: async (jwt) => (log.push(`getUser:${jwt}`), { id: U }),
    listFolder: async (bucket, folder) => {
      log.push(`list:${bucket}:${folder}`);
      return pages[bucket]?.shift() ?? [];
    },
    removeFiles: async (bucket, paths) => (log.push(`remove:${bucket}:${paths.join(',')}`), true),
    deleteUser: async (id) => (log.push(`deleteUser:${id}`), true),
    ...over,
  };
  return { deps, log };
}

const post = (headers: Record<string, string> = { Authorization: 'Bearer tok' }) =>
  new Request('https://x/functions/v1/delete-account', { method: 'POST', headers });

const body = async (res: Response) => (await res.json()) as Record<string, unknown>;

describe('access control', () => {
  test('answers CORS preflight without touching anything', async () => {
    const { deps, log } = fake();
    const res = await deleteAccount(new Request('https://x', { method: 'OPTIONS' }), deps);
    assert.equal(res.status, 204);
    assert.match(res.headers.get('Access-Control-Allow-Headers') ?? '', /authorization/);
    assert.deepEqual(log, []);
  });

  test('only POST is allowed', async () => {
    const { deps, log } = fake();
    assert.equal((await deleteAccount(new Request('https://x', { method: 'GET' }), deps)).status, 405);
    assert.equal((await deleteAccount(new Request('https://x', { method: 'DELETE' }), deps)).status, 405);
    assert.deepEqual(log, []);
  });

  for (const [name, headers] of [
    ['no Authorization header', {}],
    ['a non-Bearer scheme', { Authorization: 'Basic abc' }],
    ['an empty bearer token', { Authorization: 'Bearer ' }],
  ] as const) {
    test(`rejects ${name} before any lookup`, async () => {
      const { deps, log } = fake();
      const res = await deleteAccount(post({ ...headers }), deps);
      assert.equal(res.status, 401);
      assert.deepEqual(log, []);
    });
  }

  test('rejects a token with no user (the anon key) and deletes nothing', async () => {
    const { deps, log } = fake({ getUser: async () => null });
    assert.equal((await deleteAccount(post(), deps)).status, 401);
    assert.deepEqual(log, []);
  });

  test('treats a failing token check as unauthorized, not as a server error', async () => {
    const { deps, log } = fake({
      getUser: async () => {
        throw new Error('boom');
      },
    });
    const res = await deleteAccount(post(), deps);
    assert.equal(res.status, 401);
    assert.deepEqual(log, []);
  });
});

describe('deletion', () => {
  test('removes the user\'s files in both buckets, then the user, in that order', async () => {
    const { deps, log } = fake();
    const res = await deleteAccount(post(), deps);
    assert.equal(res.status, 200);
    assert.deepEqual(await body(res), { ok: true });
    assert.deepEqual(log, [
      'getUser:tok',
      `list:review-photos:${U}`,
      `remove:review-photos:${U}/p1.jpg,${U}/p2.jpg`,
      `list:review-photos:${U}`,
      `list:support-attachments:${U}`,
      `remove:support-attachments:${U}/a1.png`,
      `list:support-attachments:${U}`,
      `deleteUser:${U}`,
    ]);
    assert.deepEqual([...BUCKETS], ['review-photos', 'support-attachments']);
  });

  test('works for a user with no files', async () => {
    const { deps, log } = fake({ files: {} });
    assert.equal((await deleteAccount(post(), deps)).status, 200);
    assert.equal(log.at(-1), `deleteUser:${U}`);
    assert.ok(!log.some((l) => l.startsWith('remove:')));
  });

  test('keeps listing until a bucket folder is empty', async () => {
    const { deps, log } = fake({ files: { 'review-photos': [['a.jpg'], ['b.jpg'], ['c.jpg']] } });
    assert.equal((await deleteAccount(post(), deps)).status, 200);
    assert.equal(log.filter((l) => l.startsWith('remove:review-photos')).length, 3);
  });

  test('only ever deletes the user behind the token', async () => {
    const { deps, log } = fake({ getUser: async () => ({ id: 'someone-else' }) });
    await deleteAccount(post(), deps);
    assert.deepEqual(log.filter((l) => l.startsWith('deleteUser')), ['deleteUser:someone-else']);
    assert.ok(log.filter((l) => l.startsWith('remove:')).every((l) => l.includes('someone-else/')));
  });
});

describe('failures never leave a half-deleted account that cannot be retried', () => {
  test('a storage listing error stops before the user is deleted', async () => {
    const { deps, log } = fake({ listFolder: async () => null });
    const res = await deleteAccount(post(), deps);
    assert.equal(res.status, 500);
    assert.deepEqual(await body(res), { error: 'storage_cleanup_failed' });
    assert.ok(!log.some((l) => l.startsWith('deleteUser')));
  });

  test('a storage removal error stops before the user is deleted', async () => {
    const { deps, log } = fake({ removeFiles: async () => false });
    const res = await deleteAccount(post(), deps);
    assert.equal(res.status, 500);
    assert.deepEqual(await body(res), { error: 'storage_cleanup_failed' });
    assert.ok(!log.some((l) => l.startsWith('deleteUser')));
  });

  test('a listing that never empties gives up instead of looping forever', async () => {
    const { deps, log } = fake({ listFolder: async () => ['x.jpg'] });
    const res = await deleteAccount(post(), deps);
    assert.equal(res.status, 500);
    assert.ok(!log.some((l) => l.startsWith('deleteUser')));
  });

  test('a failed user deletion is reported', async () => {
    const { deps } = fake({ deleteUser: async () => false });
    const res = await deleteAccount(post(), deps);
    assert.equal(res.status, 500);
    assert.deepEqual(await body(res), { error: 'delete_failed' });
  });

  test('a thrown dependency error becomes a 500 and never leaks its message', async () => {
    const { deps } = fake({
      removeFiles: async () => {
        throw new Error('secret internal detail');
      },
    });
    const res = await deleteAccount(post(), deps);
    assert.equal(res.status, 500);
    assert.ok(!JSON.stringify(await body(res)).includes('secret'));
  });
});

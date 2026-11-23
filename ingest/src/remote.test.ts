import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { linkSourceId } from './adapters/link.js';
import { runPipeline } from './pipeline.js';
import { candidateRow, createRemoteReview, remoteConfigFromEnv, type RemoteFetch, type RemoteReview } from './remote.js';
import { FIXED_NOW, U, prepareData, seedCache } from '../test/helpers.js';

const rockKey = `link:${linkSourceId(U.rock)}`;
const selvaKey = `link:${linkSourceId(U.selva)}`;

async function setup() {
  const dir = await mkdtemp(join(tmpdir(), 'ingest-remote-'));
  const paths = { dataDir: join(dir, 'data'), outDir: join(dir, 'out'), feedDir: join(dir, 'feed'), cacheDir: join(dir, 'cache') };
  await prepareData(paths.dataDir, []);
  await seedCache(paths.cacheDir);
  await mkdir(paths.feedDir, { recursive: true });
  return paths;
}

function fakeRemote(approved: string[], rejected: string[], fail?: 'read' | 'push') {
  const pushed: string[][] = [];
  const remote: RemoteReview = {
    async decisions() {
      if (fail === 'read') throw new Error('HTTP 503');
      return { approved: new Set(approved), rejected: new Set(rejected) };
    },
    async push(pending) {
      if (fail === 'push') throw new Error('HTTP 500');
      pushed.push(pending.map((c) => c.key));
      return pending.length;
    },
  };
  return { remote, pushed };
}

test('remote config needs an https URL and the service key', () => {
  assert.equal(remoteConfigFromEnv({}), null);
  assert.equal(remoteConfigFromEnv({ SUPABASE_URL: 'http://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' }), null);
  assert.deepEqual(remoteConfigFromEnv({ SUPABASE_URL: 'https://x.supabase.co/', SUPABASE_SERVICE_ROLE_KEY: ' k ' }), { url: 'https://x.supabase.co', serviceKey: 'k' });
});

test('approved in /admin publishes and lands in approved.json; rejected leaves the queue; the rest is pushed', async () => {
  const paths = await setup();
  const { remote, pushed } = fakeRemote([rockKey], [selvaKey]);
  const r = await runPipeline({ paths, now: FIXED_NOW, offline: true, loadOptionalAdapters: false, remote });
  assert.ok(r.feed.events.some((e) => e.title === 'Rock no Quintal'), 'approved in /admin is published');
  assert.deepEqual(r.pending, []);
  assert.ok(r.skipped.some((s) => s.ref === selvaKey && /rejected/.test(s.reason)));
  assert.deepEqual(pushed, [[]]);
  assert.deepEqual(JSON.parse(await readFile(join(paths.dataDir, 'approved.json'), 'utf8')), [rockKey]);
});

test('pending records are sent; nothing changes in approved.json without new approvals', async () => {
  const paths = await setup();
  const before = await readFile(join(paths.dataDir, 'approved.json'), 'utf8');
  const { remote, pushed } = fakeRemote([], []);
  const r = await runPipeline({ paths, now: FIXED_NOW, offline: true, loadOptionalAdapters: false, remote });
  assert.deepEqual(pushed[0]!.sort(), [rockKey, selvaKey].sort());
  assert.equal(r.pending.length, 2);
  assert.equal(await readFile(join(paths.dataDir, 'approved.json'), 'utf8'), before);
});

test('a remote failure never fails the run', async () => {
  for (const fail of ['read', 'push'] as const) {
    const paths = await setup();
    const { remote } = fakeRemote([], [], fail);
    const r = await runPipeline({ paths, now: FIXED_NOW, offline: true, loadOptionalAdapters: false, remote });
    assert.equal(r.pending.length, 2);
    assert.ok(r.skipped.some((s) => s.ref === `remote:${fail === 'read' ? 'decisions' : 'push'}`));
  }
});

test('the HTTP client reads decisions and upserts on key without a status', async () => {
  const calls: { url: string; method: string; headers: Record<string, string>; body?: string }[] = [];
  const fetchImpl: RemoteFetch = async (url, init) => {
    calls.push({ url, ...init });
    const json = init.method === 'GET' ? [{ key: 'link:a', status: 'approved' }, { key: 'link:b', status: 'rejected' }, { key: 3 }] : null;
    return { ok: true, status: 200, json: async () => json, text: async () => '' };
  };
  const client = createRemoteReview({ url: 'https://x.supabase.co', serviceKey: 'svc' }, fetchImpl);
  const d = await client.decisions();
  assert.deepEqual([...d.approved], ['link:a']);
  assert.deepEqual([...d.rejected], ['link:b']);
  assert.match(calls[0]!.url, /ingest_candidates\?select=key,status&status=in\.\(approved,rejected\)$/);
  assert.equal(calls[0]!.headers.authorization, 'Bearer svc');

  const paths = await setup();
  const r = await runPipeline({ paths, now: FIXED_NOW, offline: true, loadOptionalAdapters: false, write: false });
  assert.equal(await client.push(r.pending, FIXED_NOW), 2);
  const post = calls[1]!;
  assert.match(post.url, /on_conflict=key$/);
  assert.match(post.headers.prefer!, /merge-duplicates/);
  const rows = JSON.parse(post.body!) as Record<string, unknown>[];
  assert.equal(rows.length, 2);
  for (const row of rows) assert.ok(!('status' in row));
  const rock = rows.find((x) => x.key === rockKey)!;
  assert.equal(rock.title, 'Rock no Quintal');
  assert.equal(rock.tier, 2);
  assert.equal(rock.source_url, U.rock);
  assert.deepEqual(candidateRow(r.pending[0]!, FIXED_NOW).last_seen_at, FIXED_NOW.toISOString());
});

test('approved.json keeps the object shape when it has one', async () => {
  const paths = await setup();
  await writeFile(join(paths.dataDir, 'approved.json'), JSON.stringify({ note: 'x', approved: [] }));
  const { remote } = fakeRemote([rockKey], []);
  await runPipeline({ paths, now: FIXED_NOW, offline: true, loadOptionalAdapters: false, remote });
  assert.deepEqual(JSON.parse(await readFile(join(paths.dataDir, 'approved.json'), 'utf8')), { note: 'x', approved: [rockKey] });
});

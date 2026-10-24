import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import type { SeedDataset } from '../../app/src/domain/types.js';

import { linkSourceId } from './adapters/link.js';
import { eventId, venueId } from './ids.js';
import { runPipeline } from './pipeline.js';
import { diffFeeds, parseApproved, validateFeed } from './publish.js';
import { FIXED_NOW, FIXTURES, U, prepareData, seedCache } from '../test/helpers.js';

const GOLDEN = join(FIXTURES, '..', 'golden', 'events.json');
const rockKey = `link:${linkSourceId(U.rock)}`;
const selvaKey = `link:${linkSourceId(U.selva)}`;

function previousFeed(): SeedDataset {
  const base = {
    venueId: venueId('bolt'),
    priceMin: 20,
    priceMax: 20,
    isFree: false,
    ageMin: 18,
    genreSlugs: ['funk'],
    artistIds: [],
    status: 'published' as const,
    coverKey: 'generic',
    popularity: 50,
  };
  return {
    generatedAt: '2026-10-24T00:00:00.000Z',
    genres: [],
    venues: [],
    artists: [],
    events: [
      { ...base, id: eventId(`link:${linkSourceId(U.gone)}`), title: 'Evento removido da página', startsAt: '2026-11-25T01:00:00.000Z', ticketUrl: U.gone },
      { ...base, id: eventId('manual:old'), title: 'Já passou', startsAt: '2026-10-20T01:00:00.000Z', endsAt: '2026-10-20T06:00:00.000Z' },
      { ...base, id: eventId('manual:carried'), title: 'Evento carregado', startsAt: '2026-12-05T01:00:00.000Z' },
    ],
  };
}

async function setup(approved: string[] = []) {
  const dir = await mkdtemp(join(tmpdir(), 'ingest-e2e-'));
  const paths = { dataDir: join(dir, 'data'), outDir: join(dir, 'out'), feedDir: join(dir, 'feed'), cacheDir: join(dir, 'cache') };
  await prepareData(paths.dataDir, approved);
  await seedCache(paths.cacheDir);
  await mkdir(paths.feedDir, { recursive: true });
  // venue for the carried events must exist in the previous feed
  const prev = previousFeed();
  const bolt = JSON.parse(await readFile(join(FIXTURES, '..', '..', 'data', 'venues.json'), 'utf8')).find((v: { id: string }) => v.id === 'bolt');
  prev.venues.push({ id: venueId('bolt'), slug: 'bolt', name: 'Bolt', area: bolt.area, city: bolt.city, lat: bolt.lat, lng: bolt.lng, status: 'open', adultOnly: true, genreSlugs: ['funk'], coverKey: 'bolt', placeholder: true });
  await writeFile(join(paths.feedDir, 'events.json'), JSON.stringify(prev));
  return { dir, paths };
}

test('end to end (offline fixtures): tier 1 auto-approved, tier 2 pending, lifecycle applied', async () => {
  const { paths } = await setup();
  const r = await runPipeline({ paths, now: FIXED_NOW, offline: true, loadOptionalAdapters: false });
  assert.deepEqual(r.problems, []);

  const titles = r.feed.events.map((e) => e.title);
  assert.ok(titles.includes('Quarta de Karaokê'));
  assert.ok(titles.includes('Roda de Samba da Penha'));
  assert.ok(titles.includes('Evento carregado'), 'previous events are carried forward');
  assert.ok(!titles.includes('Já passou'), 'ended > 24 h ago is dropped');
  assert.ok(!titles.includes('Rock no Quintal'), 'tier 2 is not published without approval');
  assert.deepEqual(r.pending.map((c) => c.key).sort(), [rockKey, selvaKey].sort());

  const gone = r.feed.events.find((e) => e.title === 'Evento removido da página')!;
  assert.equal(gone.status, 'cancelled', 'page 404 cancels the published event');

  // cross-source merge: link page + CSV row are one event, tier 1 record wins
  const baile = r.feed.events.filter((e) => /Baile do Bolt/.test(e.title));
  assert.equal(baile.length, 1);
  assert.equal(baile[0]!.title, 'Baile do Bolt Novembro');
  assert.equal(baile[0]!.priceMin, 35);
  const merged = r.candidates.find((c) => c.event.id === baile[0]!.id)!;
  assert.deepEqual(merged.sources.map((s) => s.source).sort(), ['link', 'manual']);

  assert.equal(r.needsReview.some((n) => n.ref === U.empty), true);
  assert.equal(r.needsReview.some((n) => /casas\.json#3/.test(n.ref)), true);
  assert.deepEqual(r.skipped.map((s) => s.ref), [U.blocked]);

  // output files
  const written = JSON.parse(await readFile(join(paths.feedDir, 'events.json'), 'utf8')) as SeedDataset;
  assert.deepEqual(validateFeed(written), []);
  const meta = JSON.parse(await readFile(join(paths.feedDir, 'meta.json'), 'utf8'));
  assert.equal(meta.schemaVersion, 1);
  assert.equal(meta.generatedAt, FIXED_NOW.toISOString());
  assert.equal(meta.counts.events, written.events.length);
  assert.ok(meta.sources.manual >= 4 && meta.sources.carried === 2);
  const cand = JSON.parse(await readFile(join(paths.outDir, 'candidates.json'), 'utf8'));
  assert.equal(cand.counts.pendingApproval, 2);
  assert.ok(cand.needsReview.length >= 2 && cand.skipped.length === 1);
  assert.match(await readFile(join(paths.outDir, 'pr-title.txt'), 'utf8'), /^Ingest 2026-11-01: \d+ new, \d+ changed, \d+ cancelled\s*$/);
  assert.match(await readFile(join(paths.outDir, 'summary.md'), 'utf8'), /Waiting for approval/);
});

test('approval: a tier 2 record appears once its source:sourceId is in approved.json; golden events.json', async () => {
  const { paths } = await setup([rockKey, selvaKey]);
  const r = await runPipeline({ paths, now: FIXED_NOW, offline: true, loadOptionalAdapters: false });
  assert.deepEqual(r.pending, []);
  const rock = r.feed.events.find((e) => e.title === 'Rock no Quintal')!;
  assert.ok(rock);
  assert.deepEqual(rock.artistIds.length, 3, 'artists parsed from an explicit "Show com A, B e C" sentence');
  assert.equal(rock.isFree, true);
  const selva = r.feed.events.find((e) => e.title.startsWith('Forró da Selva'))!;
  assert.equal(selva.status, 'cancelled');
  assert.equal(selva.startsAt, '2026-11-21T01:00:00.000Z');
  assert.equal(selva.artistIds.length, 2);
  assert.ok(r.feed.venues.some((v) => v.slug === 'quintal-rock-bar' && v.status === 'unverified'));

  const text = JSON.stringify(r.feed, null, 2) + '\n';
  if (process.env.UPDATE_GOLDEN === '1') {
    await mkdir(join(GOLDEN, '..'), { recursive: true });
    await writeFile(GOLDEN, text);
  }
  assert.equal(text, (await readFile(GOLDEN, 'utf8')).replace(/\r\n/g, '\n'),'golden events.json changed (rerun with UPDATE_GOLDEN=1 if intended)');
});

test('re-running on its own output is stable (no diff, same events)', async () => {
  const { paths } = await setup([rockKey]);
  const first = await runPipeline({ paths, now: FIXED_NOW, offline: true, loadOptionalAdapters: false });
  const second = await runPipeline({ paths, now: new Date(FIXED_NOW.getTime() + 3600_000), offline: true, loadOptionalAdapters: false });
  assert.deepEqual(second.diff, { added: [], changed: [], cancelled: [], removed: [] });
  assert.deepEqual(second.feed.events, first.feed.events);
  assert.equal(second.feed.generatedAt, first.feed.generatedAt, 'unchanged content keeps generatedAt so quiet days open no PR');
  assert.equal(second.prTitle, 'Ingest 2026-11-01: 0 new, 0 changed, 0 cancelled');
});

test('diff against the previous feed counts new / changed / cancelled', async () => {
  const { paths } = await setup();
  const r = await runPipeline({ paths, now: FIXED_NOW, offline: true, loadOptionalAdapters: false });
  assert.equal(r.diff.added.length, 4); // karaoke, sexta sertaneja, baile, samba
  assert.equal(r.diff.cancelled.length, 1);
  assert.equal(r.diff.removed.length, 1);
  const d = diffFeeds(r.feed.events, r.feed.events.map((e) => ({ ...e, priceMax: 999 })));
  assert.equal(d.changed.length, r.feed.events.length);
});

test('--fresh drops previous events; write:false touches nothing', async () => {
  const { paths } = await setup();
  const r = await runPipeline({ paths, now: FIXED_NOW, offline: true, fresh: true, write: false, loadOptionalAdapters: false });
  assert.ok(!r.feed.events.some((e) => e.title === 'Evento carregado'));
  assert.ok(r.feed.venues.every((v) => r.feed.events.some((e) => e.venueId === v.id)));
  const onDisk = JSON.parse(await readFile(join(paths.feedDir, 'events.json'), 'utf8')) as SeedDataset;
  assert.equal(onDisk.generatedAt, '2026-10-24T00:00:00.000Z');
});

test('a failing adapter does not abort the run and never cancels anything', async () => {
  const { paths } = await setup();
  const r = await runPipeline({
    paths,
    now: FIXED_NOW,
    loadOptionalAdapters: false,
    write: false,
    adapters: [
      { id: 'broken', tier: 2, enabled: () => true, fetch: async () => { throw new Error('boom'); } },
      { id: 'off', tier: 3, enabled: () => false, fetch: async () => { throw new Error('should not run'); } },
    ],
  });
  assert.deepEqual(r.skipped, [{ ref: 'adapter:broken', reason: 'boom' }]);
  assert.ok(r.feed.events.some((e) => e.title === 'Evento carregado' && e.status === 'published'));
});

test('validateFeed rejects malformed feeds (schema contract with the app)', () => {
  assert.ok(validateFeed(null).length > 0);
  assert.ok(validateFeed({ generatedAt: 'x', genres: [], venues: [], artists: [], events: [] }).length > 0);
  const ok: SeedDataset = { generatedAt: '2026-11-01T00:00:00.000Z', genres: [{ id: 'g', slug: 'funk', label: 'Funk' }], venues: [], artists: [], events: [] };
  assert.deepEqual(validateFeed(ok), []);
  const bad = { ...ok, events: [{ id: 'e', title: 't', venueId: 'missing', startsAt: '2026-11-01T00:00:00.000Z', priceMin: -1, priceMax: null, isFree: false, ageMin: 18, genreSlugs: ['nope'], artistIds: [], status: 'published', coverKey: 'generic', ticketUrl: 'http://x', popularity: 120 }] };
  const errs = validateFeed(bad).join('|');
  assert.match(errs, /unknown venue/);
  assert.match(errs, /priceMin/);
  assert.match(errs, /genreSlugs/);
  assert.match(errs, /https/);
  assert.match(errs, /popularity/);
});

test('approved.json parsing tolerates both shapes', () => {
  assert.deepEqual([...parseApproved(['a:1', 'b:2'])], ['a:1', 'b:2']);
  assert.deepEqual([...parseApproved({ approved: ['a:1'] })], ['a:1']);
  assert.equal(parseApproved(null).size, 0);
});

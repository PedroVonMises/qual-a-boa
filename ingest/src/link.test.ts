import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { FIXED_NOW, U, fakeFetch, prepareData } from '../test/helpers.js';
import { addLink, canonicalUrl, createLinkAdapter, parseEventPage, parseLinksFile } from './adapters/link.js';
import { PoliteClient, parseRobots } from './http.js';
import { USER_AGENT } from './types.js';
import { readFile as rf } from 'node:fs/promises';
import { FIXTURES } from '../test/helpers.js';

const html = (n: string) => rf(join(FIXTURES, 'pages', n), 'utf8');
const tmp = () => mkdtemp(join(tmpdir(), 'ingest-'));

test('JSON-LD Event: name, dates, venue, BRL price range, no image', async () => {
  const p = parseEventPage(await html('baile-bolt.html'));
  assert.equal(p.via, 'json-ld');
  assert.ok(p.event);
  assert.equal(p.event.title, 'Baile do Bolt - Edição Novembro');
  assert.equal(p.event.startsAt, '2026-11-14T23:00:00-03:00');
  assert.equal(p.event.endsAt, '2026-11-15T05:00:00-03:00');
  assert.equal(p.event.venueName, 'Bolt');
  assert.equal(p.event.venueAddress, 'R. Darcy Grijó, 20, Vitória, ES');
  assert.equal(p.event.priceMin, 30);
  assert.equal(p.event.priceMax, 60);
  assert.equal(p.event.status, 'scheduled');
  assert.equal(p.event.imageUrl, undefined);
});

test('JSON-LD inside @graph, local time without offset, cancelled, comma prices', async () => {
  const p = parseEventPage(await html('forro-selva.html'));
  assert.ok(p.event);
  assert.equal(p.event.startsAt, '2026-11-20T22:00:00-03:00');
  assert.equal(p.event.status, 'cancelled');
  assert.equal(p.event.priceMin, 25);
  assert.equal(p.event.priceMax, 1200);
  assert.equal(p.event.venueName, 'A Selva Vitória');
});

test('OpenGraph / <time> / itemprop fallback', async () => {
  const p = parseEventPage(await html('rock-quintal.html'));
  assert.equal(p.via, 'opengraph');
  assert.ok(p.event);
  assert.equal(p.event.title, 'Rock no Quintal');
  assert.equal(p.event.startsAt, '2026-11-21T20:30:00-03:00');
  assert.equal(p.event.endsAt, '2026-11-22T00:30:00-03:00');
  assert.equal(p.event.venueName, 'Quintal Rock Bar');
  assert.equal(p.event.isFree, true);
});

test('unparsable page is a problem, not a guessed event', async () => {
  const p = parseEventPage(await html('sem-dados.html'));
  assert.equal(p.event, undefined);
  assert.match(p.problem ?? '', /time/);
});

test('non-BRL prices and postponed events need review', () => {
  const mk = (extra: string) =>
    `<script type="application/ld+json">{"@type":"Event","name":"X","startDate":"2026-12-01T20:00:00-03:00","location":{"name":"Y"}${extra}}</script>`;
  assert.match(parseEventPage(mk(',"offers":{"price":"10","priceCurrency":"USD"}')).problem ?? '', /BRL/);
  assert.match(parseEventPage(mk(',"eventStatus":"https://schema.org/EventPostponed"')).problem ?? '', /postponed/);
  assert.match(parseEventPage('<script type="application/ld+json">{broken</script><title>t</title>').problem ?? '', /./);
});

test('robots.txt parsing: agent group, longest match, allow beats disallow on ties', () => {
  const r = parseRobots('User-agent: *\nDisallow: /evento/\nAllow: /evento/publico\n\nUser-agent: qualaboabot\nDisallow: /privado');
  assert.equal(r.allows('/privado/x'), false);
  assert.equal(r.allows('/evento/1'), true); // our own group has no rule for it
  const star = parseRobots('User-agent: *\nDisallow: /evento/\nAllow: /evento/publico');
  assert.equal(star.allows('/evento/1'), false);
  assert.equal(star.allows('/evento/publico/2'), true);
  assert.equal(parseRobots('User-agent: *\nDisallow:').allows('/x'), true);
  assert.equal(parseRobots('User-agent: *\nDisallow: /').allows('/x'), false);
});

test('links file parsing and canonical urls', () => {
  assert.equal(canonicalUrl('https://a.example/e/1?utm_source=x&id=2#frag'), 'https://a.example/e/1?id=2');
  assert.deepEqual(parseLinksFile('# c\n\nhttps://a.example/e/1 # note\nhttp://insecure.example/x\nnot a url\nhttps://a.example/e/1\n'), ['https://a.example/e/1']);
});

test('addLink validates https and avoids duplicates', async () => {
  const dir = await tmp();
  assert.deepEqual(await addLink(dir, 'https://a.example/e/1?utm_campaign=z'), { added: true, url: 'https://a.example/e/1' });
  assert.equal((await addLink(dir, 'https://a.example/e/1')).added, false);
  await assert.rejects(addLink(dir, 'http://a.example/e/2'), /https/);
  await assert.rejects(addLink(dir, 'nope'), /valid/);
  assert.equal(await readFile(join(dir, 'links.txt'), 'utf8'), 'https://a.example/e/1\n');
});

test('adapter: robots disallow is honored (page never requested), UA sent, gone/needs-review reported', async () => {
  const dir = await tmp();
  await prepareData(join(dir, 'data'));
  const ff = await fakeFetch();
  const sleeps: number[] = [];
  const a = createLinkAdapter({ dataDir: join(dir, 'data'), cacheDir: join(dir, 'cache'), fetchImpl: ff.fn, sleep: async (ms) => void sleeps.push(ms) });
  const events = await a.fetch({ now: FIXED_NOW, userAgent: USER_AGENT, dataDir: join(dir, 'data'), log: () => {} });

  assert.deepEqual(events.map((e) => e.title).sort(), ['Baile do Bolt - Edição Novembro', 'Forró da Selva com Trio Siriguella e Luana Dias', 'Rock no Quintal']);
  assert.ok(!ff.calls.some((c) => c.url === U.blocked), 'disallowed page must not be fetched');
  assert.ok(ff.calls.some((c) => c.url === 'https://blocked.example.com/robots.txt'));
  assert.ok(ff.calls.every((c) => c.ua === USER_AGENT));
  assert.deepEqual(a.report.skipped.map((s) => s.ref), [U.blocked]);
  assert.deepEqual(a.report.gone, [U.gone]);
  assert.equal(a.report.needsReview.length, 1);
  assert.equal(a.report.needsReview[0]!.ref, U.empty);
  // 2 requests to ingressos.example.com.br (robots + page 1) must be spaced: at least one 2000 ms wait happened
  assert.ok(sleeps.some((ms) => ms > 1000), 'same-host requests are throttled');
});

test('adapter: second run uses the cache (no network), robots cached per host', async () => {
  const dir = await tmp();
  await prepareData(join(dir, 'data'));
  const ff = await fakeFetch();
  const mk = (f: typeof ff) => createLinkAdapter({ dataDir: join(dir, 'data'), cacheDir: join(dir, 'cache'), fetchImpl: f.fn, sleep: async () => {} });
  const ctx = { now: FIXED_NOW, userAgent: USER_AGENT, dataDir: join(dir, 'data'), log: () => {} };
  await mk(ff).fetch(ctx);
  const first = ff.calls.length;
  assert.ok(first > 0);
  const ff2 = await fakeFetch();
  const second = await mk(ff2).fetch(ctx);
  assert.equal(ff2.calls.length, 1, 'only the uncached 404 page is requested again');
  assert.equal(second.length, 3);
  // robots.txt is fetched once per host within a run
  assert.equal(ff.calls.filter((c) => c.url === 'https://agenda.example.net/robots.txt').length, 1);
});

test('client: 403/429 stops requests to that host for the run', async () => {
  const dir = await tmp();
  const calls: string[] = [];
  const c = new PoliteClient({
    userAgent: USER_AGENT,
    cacheDir: dir,
    sleep: async () => {},
    fetchImpl: async (url) => {
      calls.push(url);
      return { status: url.endsWith('robots.txt') ? 404 : 429, headers: { get: () => 'text/html' }, text: async () => '' };
    },
  });
  assert.equal((await c.get('https://x.example/a')).kind, 'blocked');
  assert.equal((await c.get('https://x.example/b')).kind, 'blocked');
  assert.equal(calls.filter((u) => u.includes('/b')).length, 0);
});

test('client: robots 5xx or network failure means refuse; http urls never fetched', async () => {
  const dir = await tmp();
  const c = new PoliteClient({
    userAgent: USER_AGENT,
    cacheDir: dir,
    sleep: async () => {},
    fetchImpl: async () => ({ status: 503, headers: { get: () => null }, text: async () => '' }),
  });
  assert.equal((await c.get('https://x.example/a')).kind, 'robots-disallowed');
  assert.equal((await c.get('http://x.example/a')).kind, 'error');
});

test('client: offline mode never calls fetch', async () => {
  const dir = await tmp();
  const c = new PoliteClient({
    userAgent: USER_AGENT,
    cacheDir: dir,
    offline: true,
    fetchImpl: async () => {
      throw new Error('network used');
    },
  });
  assert.equal((await c.get('https://x.example/a')).kind, 'robots-disallowed');
});

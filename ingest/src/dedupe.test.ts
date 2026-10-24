import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { EventItem } from '../../app/src/domain/types.js';

import { MERGE_WINDOW_MS, applyLifecycle, dedupeBySourceId, isStale, mergeCrossSource } from './dedupe.js';
import { eventId, venueId } from './ids.js';
import type { Candidate } from './normalize.js';
import { titleSimilarity } from './text.js';

function cand(o: { source: string; sourceId: string; tier: 1 | 2 | 3; title: string; start: string; venue?: string; fetchedAt?: string; priceMin?: number | null; endsAt?: string }): Candidate {
  const event: EventItem = {
    id: eventId(`${o.source}:${o.sourceId}`),
    title: o.title,
    venueId: venueId(o.venue ?? 'bolt'),
    startsAt: o.start,
    ...(o.endsAt && { endsAt: o.endsAt }),
    priceMin: o.priceMin ?? null,
    priceMax: o.priceMin ?? null,
    isFree: false,
    ageMin: 18,
    genreSlugs: ['funk'],
    artistIds: [],
    status: 'published',
    coverKey: 'generic',
    popularity: 50,
  };
  return {
    key: `${o.source}:${o.sourceId}`,
    tier: o.tier,
    sources: [{ source: o.source, sourceId: o.sourceId, url: 'https://x.example/' + o.sourceId, tier: o.tier }],
    event,
    venue: { id: event.venueId, slug: o.venue ?? 'bolt', name: 'Bolt', area: 'a', city: 'Vitória', lat: 0, lng: 0, status: 'open', adultOnly: true, genreSlugs: [], coverKey: 'generic', placeholder: false },
    venueMatched: true,
    artists: [],
    flags: o.priceMin == null ? ['price-unknown'] : [],
    fetchedAt: o.fetchedAt ?? '2026-11-01T00:00:00.000Z',
    rawStatus: 'scheduled',
  };
}

test('title similarity is token Jaccard without filler words', () => {
  assert.ok(titleSimilarity('Baile do Bolt - Edição Novembro', 'Baile do Bolt Novembro') >= 0.6);
  assert.ok(titleSimilarity('Baile do Bolt', 'Noite Sertaneja') < 0.6);
});

test('primary dedupe on (source, sourceId): newest fetch wins', () => {
  const out = dedupeBySourceId([
    cand({ source: 'link', sourceId: '1', tier: 2, title: 'Velho', start: '2026-11-15T02:00:00.000Z', fetchedAt: '2026-11-01T00:00:00.000Z' }),
    cand({ source: 'link', sourceId: '1', tier: 2, title: 'Novo', start: '2026-11-15T02:00:00.000Z', fetchedAt: '2026-11-02T00:00:00.000Z' }),
    cand({ source: 'link', sourceId: '2', tier: 2, title: 'Outro', start: '2026-11-16T02:00:00.000Z' }),
  ]);
  assert.equal(out.length, 2);
  assert.equal(out.find((c) => c.key === 'link:1')!.event.title, 'Novo');
});

test('cross-source merge: same venue, within 2 h, similar title; higher tier kept, sources recorded, gaps filled', () => {
  const link = cand({ source: 'link', sourceId: 'a', tier: 2, title: 'Baile do Bolt - Edição Novembro', start: '2026-11-15T02:00:00.000Z', priceMin: 30, endsAt: '2026-11-15T08:00:00.000Z' });
  const manual = cand({ source: 'manual', sourceId: 'm', tier: 1, title: 'Baile do Bolt Novembro', start: '2026-11-15T02:30:00.000Z' });
  const out = mergeCrossSource([link, manual]);
  assert.equal(out.length, 1);
  const m = out[0]!;
  assert.equal(m.key, 'manual:m');
  assert.equal(m.tier, 1);
  assert.deepEqual(m.sources.map((s) => s.source).sort(), ['link', 'manual']);
  assert.equal(m.event.title, 'Baile do Bolt Novembro');
  assert.equal(m.event.priceMin, 30, 'missing price filled from the other source');
  assert.equal(m.event.endsAt, '2026-11-15T08:00:00.000Z');
  assert.ok(!m.flags.includes('price-unknown'));
});

test('no merge: different venue, start > 2 h apart, dissimilar title, or same source', () => {
  const base = { tier: 2 as const, title: 'Baile do Bolt', start: '2026-11-15T02:00:00.000Z' };
  const other = (o: Partial<Parameters<typeof cand>[0]>) => mergeCrossSource([cand({ source: 'link', sourceId: 'a', ...base }), cand({ source: 'manual', sourceId: 'b', ...base, tier: 1, ...o })]);
  assert.equal(other({ venue: 'a-selva' }).length, 2);
  assert.equal(other({ start: new Date(Date.parse(base.start) + MERGE_WINDOW_MS + 60_000).toISOString() }).length, 2);
  assert.equal(other({ title: 'Noite Sertaneja' }).length, 2);
  assert.equal(mergeCrossSource([cand({ source: 'link', sourceId: 'a', ...base }), cand({ source: 'link', sourceId: 'b', ...base })]).length, 2);
  assert.equal(other({ start: new Date(Date.parse(base.start) + MERGE_WINDOW_MS).toISOString() }).length, 1, 'exactly 2 h still merges');
});

test('stale logic: ended > 24 h ago is dropped; gone pages cancel; cancelled kept', () => {
  const now = new Date('2026-11-10T12:00:00.000Z');
  const mk = (id: string, start: string, end?: string, status: EventItem['status'] = 'published'): EventItem => ({
    ...cand({ source: 's', sourceId: id, tier: 1, title: id, start, ...(end && { endsAt: end }) }).event,
    status,
  });
  const ended30h = mk('ended30h', '2026-11-08T22:00:00.000Z', '2026-11-09T06:00:00.000Z');
  const ended10h = mk('ended10h', '2026-11-09T22:00:00.000Z', '2026-11-10T02:00:00.000Z');
  const noEndOld = mk('noendold', '2026-11-08T12:00:00.000Z');
  const future = mk('future', '2026-11-20T22:00:00.000Z');
  const pageGone = mk('pagegone', '2026-11-21T22:00:00.000Z');
  const cancelled = mk('cancelled', '2026-11-22T22:00:00.000Z', undefined, 'cancelled');

  assert.ok(isStale(ended30h, now));
  assert.ok(!isStale(ended10h, now));
  const r = applyLifecycle([], { now, previous: [ended30h, ended10h, noEndOld, future, pageGone, cancelled], goneIds: new Set([pageGone.id]) }, true);
  assert.deepEqual(r.events.map((e) => e.title).sort(), ['cancelled', 'ended10h', 'future', 'pagegone']);
  assert.equal(r.events.find((e) => e.title === 'pagegone')!.status, 'cancelled');
  assert.deepEqual(r.cancelled, [pageGone.id]);
  assert.deepEqual(r.dropped.sort(), [ended30h.id, noEndOld.id].sort());
});

test('fresh events override carried ones; carryForward=false ignores previous', () => {
  const now = new Date('2026-11-10T12:00:00.000Z');
  const old = cand({ source: 's', sourceId: '1', tier: 1, title: 'Old title', start: '2026-11-20T22:00:00.000Z' }).event;
  const fresh = { ...old, title: 'New title' };
  assert.equal(applyLifecycle([fresh], { now, previous: [old], goneIds: new Set() }, true).events[0]!.title, 'New title');
  assert.equal(applyLifecycle([], { now, previous: [old], goneIds: new Set() }, false).events.length, 0);
});

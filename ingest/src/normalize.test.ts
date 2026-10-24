import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { artistId, eventId, uuidFromSlug, venueId } from './ids.js';
import { VenueIndex, artistsFromText, classifyGenres, normalizeEvent, popularityOf, type GenreKeywords, type VenueEntry } from './normalize.js';
import type { RawEvent } from './types.js';

const root = join(import.meta.dirname, '..', 'data');
const venues = new VenueIndex(JSON.parse(readFileSync(join(root, 'venues.json'), 'utf8')) as VenueEntry[]);
const keywords = JSON.parse(readFileSync(join(root, 'genre-keywords.json'), 'utf8')) as GenreKeywords;
const deps = { venues, keywords, tier: (s: string) => (s === 'manual' ? (1 as const) : (2 as const)) };

const raw = (o: Partial<RawEvent> = {}): RawEvent => ({
  source: 'link',
  sourceId: 'abc',
  url: 'https://ex.example/e/1',
  title: 'Festa Qualquer',
  startsAt: '2026-11-14T23:00:00-03:00',
  venueName: 'Bolt',
  fetchedAt: '2026-11-01T12:00:00.000Z',
  ...o,
});

test('ids reuse the seed namespaces (known md5-v3 uuid format)', () => {
  assert.match(uuidFromSlug('venue:bolt'), /^[0-9a-f]{8}-[0-9a-f]{4}-3[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  // value present in app/src/data/seed.json for Bolt
  assert.equal(venueId('bolt'), '4627b1f7-a171-34ed-a493-6e33412ad704');
  assert.equal(artistId('dj-maresia'), 'afd11fda-5593-3387-a6a6-4ed34dab6143');
});

test('venue matching: exact, alias, contained name, address, unknown', () => {
  assert.equal(venues.match('Bolt')?.entry.id, 'bolt');
  assert.equal(venues.match('BOLT Vitória')?.entry.id, 'bolt');
  assert.equal(venues.match('A Selva Vitória')?.entry.id, 'a-selva');
  assert.equal(venues.match('Selva Casa de Eventos')?.entry.id, 'a-selva');
  assert.equal(venues.match('Pub426')?.entry.id, 'pub-426');
  assert.equal(venues.match('Gordinho - Praia do Canto')?.entry.id, 'gordinho');
  assert.equal(venues.match('Espaço Nova Era', 'Rua Joaquim Lírio, 823 - Praia do Canto')?.how, 'address');
  assert.equal(venues.match('Quintal Rock Bar', 'Rua das Palmeiras, 100'), null);
  assert.equal(venues.match('Boate Garden'), null);
});

test('time zone: -03:00 and bare local times become UTC', async () => {
  const a = await normalizeEvent(raw({ startsAt: '2026-11-14T23:00:00-03:00', endsAt: '2026-11-15T05:00:00-03:00' }), deps);
  assert.ok(a.ok);
  assert.equal(a.candidate.event.startsAt, '2026-11-15T02:00:00.000Z');
  assert.equal(a.candidate.event.endsAt, '2026-11-15T08:00:00.000Z');
  const b = await normalizeEvent(raw({ startsAt: '2026-11-14T23:00' }), deps);
  assert.ok(b.ok);
  assert.equal(b.candidate.event.startsAt, '2026-11-15T02:00:00.000Z');
  const bad = await normalizeEvent(raw({ startsAt: 'amanhã' }), deps);
  assert.equal(bad.ok, false);
});

test('prices: range, single, free, unknown', async () => {
  const range = await normalizeEvent(raw({ priceMin: 60, priceMax: 30 }), deps);
  assert.ok(range.ok);
  assert.deepEqual([range.candidate.event.priceMin, range.candidate.event.priceMax, range.candidate.event.isFree], [30, 60, false]);
  const single = await normalizeEvent(raw({ priceMin: 40 }), deps);
  assert.ok(single.ok);
  assert.deepEqual([single.candidate.event.priceMin, single.candidate.event.priceMax], [40, 40]);
  const free = await normalizeEvent(raw({ isFree: true }), deps);
  assert.ok(free.ok);
  assert.deepEqual([free.candidate.event.priceMin, free.candidate.event.priceMax, free.candidate.event.isFree], [0, 0, true]);
  const zero = await normalizeEvent(raw({ priceMin: 0, priceMax: 0 }), deps);
  assert.ok(zero.ok);
  assert.equal(zero.candidate.event.isFree, true);
  const unknown = await normalizeEvent(raw(), deps);
  assert.ok(unknown.ok);
  assert.deepEqual([unknown.candidate.event.priceMin, unknown.candidate.event.priceMax, unknown.candidate.event.isFree], [null, null, false]);
  assert.ok(unknown.candidate.flags.includes('price-unknown'));
});

test('defaults: ageMin 18, https ticket url, coverKey generic, placeholder false, no invented artists', async () => {
  const r = await normalizeEvent(raw(), deps);
  assert.ok(r.ok);
  assert.equal(r.candidate.event.ageMin, 18);
  assert.equal(r.candidate.event.ticketUrl, 'https://ex.example/e/1');
  assert.equal(r.candidate.event.coverKey, 'generic');
  assert.equal(r.candidate.venue.placeholder, false);
  assert.deepEqual(r.candidate.event.artistIds, []);
  assert.equal(r.candidate.event.status, 'published');
  assert.equal(r.candidate.event.id, eventId('link:abc'));
  const stated = await normalizeEvent(raw({ ageMin: 16 }), deps);
  assert.ok(stated.ok && stated.candidate.event.ageMin === 16);
  const http = await normalizeEvent(raw({ url: 'http://ex.example/e/1' }), deps);
  assert.ok(http.ok && http.candidate.event.ticketUrl === undefined && http.candidate.flags.includes('ticket-url-not-https'));
  const cancelled = await normalizeEvent(raw({ status: 'cancelled' }), deps);
  assert.ok(cancelled.ok && cancelled.candidate.event.status === 'cancelled');
});

test('images are used only for tier 1 partner-supplied https posters', async () => {
  const t2 = await normalizeEvent(raw({ imageUrl: 'https://cdn.example/p.jpg' }), deps);
  assert.ok(t2.ok && t2.candidate.event.imageUrl === undefined);
  const t1 = await normalizeEvent(raw({ source: 'manual', imageUrl: 'https://cdn.example/p.jpg' }), deps);
  assert.ok(t1.ok && t1.candidate.event.imageUrl === 'https://cdn.example/p.jpg');
});

test('unknown venue becomes an unverified draft with approximate location', async () => {
  const r = await normalizeEvent(raw({ venueName: 'Quintal Rock Bar', venueAddress: 'Rua das Palmeiras, 100 - Serra' }), deps);
  assert.ok(r.ok);
  assert.equal(r.candidate.venue.status, 'unverified');
  assert.equal(r.candidate.venue.city, 'Serra');
  assert.equal(r.candidate.venue.slug, 'quintal-rock-bar');
  assert.equal(r.candidate.venue.id, venueId('quintal-rock-bar'));
  assert.ok(r.candidate.flags.includes('venue-unverified'));
  assert.ok(r.candidate.flags.includes('venue-location-approximate'));
});

test('geocoder (injected) supplies coordinates; failure falls back', async () => {
  const geo = await normalizeEvent(raw({ venueName: 'Quintal Rock Bar' }), { ...deps, geocode: async () => ({ lat: -20.1, lng: -40.2 }) });
  assert.ok(geo.ok && geo.candidate.venue.lat === -20.1 && !geo.candidate.flags.includes('venue-location-approximate'));
  const none = await normalizeEvent(raw({ venueName: 'Quintal Rock Bar' }), { ...deps, geocode: async () => null });
  assert.ok(none.ok && none.candidate.flags.includes('venue-location-approximate'));
});

test('genre classifier: keywords first, venue genres as fallback', () => {
  assert.deepEqual(classifyGenres('Baile Funk do Bolt', keywords, ['rock-indie']), ['funk']);
  assert.deepEqual(classifyGenres('Noite de Samba e Pagode', keywords, []), ['pagode-samba']);
  assert.deepEqual(classifyGenres('Sertanejo Universitário', keywords, []), ['sertanejo']);
  assert.deepEqual(classifyGenres('Quarta de Karaokê', keywords, []), ['karaoke-ao-vivo']);
  assert.deepEqual(classifyGenres('Techno e Hip Hop', keywords, []), ['eletronica-house', 'hip-hop-rnb']);
  assert.deepEqual(classifyGenres('Festa Qualquer', keywords, ['funk', 'pop-hits', 'rock-indie']), ['funk', 'pop-hits']);
  assert.deepEqual(classifyGenres('Festa Qualquer', keywords, []), []);
  // whole words only
  assert.deepEqual(classifyGenres('Popular encontro', keywords, []), []);
});

test('artists only when explicit', async () => {
  assert.deepEqual(artistsFromText('Rock no Quintal com Os Vizinhos, Lua Nova e Maria Clara.'), ['Os Vizinhos', 'Lua Nova', 'Maria Clara']);
  assert.deepEqual(artistsFromText('Forró com Trio Siriguella'), ['Trio Siriguella']);
  assert.deepEqual(artistsFromText('Festa com open bar e muito mais'), []);
  assert.deepEqual(artistsFromText('Sexta com banda ao vivo'), []);
  assert.deepEqual(artistsFromText('Noite de Funk'), []);
  assert.deepEqual(artistsFromText('com diversão total pra galera animada da cidade toda'), []);
  const lineup = await normalizeEvent(raw({ lineup: ['DJ Pedrinho', 'MC Aurora', 'DJ Pedrinho'] }), deps);
  assert.ok(lineup.ok);
  assert.deepEqual(lineup.candidate.artists.map((a) => a.name), ['DJ Pedrinho', 'MC Aurora']);
  assert.deepEqual(lineup.candidate.event.artistIds, [artistId('dj-pedrinho'), artistId('mc-aurora')]);
  const fromTitle = await normalizeEvent(raw({ title: 'Sexta com Henrique Alves e Dupla Pé de Serra' }), deps);
  assert.ok(fromTitle.ok);
  assert.equal(fromTitle.candidate.artists.length, 2);
});

test('popularity is derived, bounded and documented', () => {
  assert.equal(popularityOf({ tier: 2, priceMax: null, artistCount: 0 }), 50);
  assert.equal(popularityOf({ tier: 1, priceMax: 130, artistCount: 3 }), 77);
  assert.equal(popularityOf({ tier: 1, priceMax: 70, artistCount: 10 }), 72);
});

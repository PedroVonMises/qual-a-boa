import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';

import type { SeedDataset } from '../../app/src/domain/types';
import { dedupeVenues, validateVenue } from '../../app/src/domain/venueSchema';
import { buildSeed, uuidFromSlug } from '../seed/seed-data';
import { datasetToSql } from '../seed/sql';
import { createDb, FIXED_NOW, REPO_ROOT, type DB } from './harness';

const ds: SeedDataset = buildSeed(new Date(FIXED_NOW));
const now = Date.parse(FIXED_NOW);

let db: DB;
before(async () => { db = await createDb(); });
after(async () => { await db.close(); });

describe('migrations', () => {
  test('apply cleanly and create all tables with RLS enabled', async () => {
    const r = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' order by 1`);
    assert.deepEqual(r.rows.map((x) => x.relname), [
      'artists', 'checkins', 'comment_votes', 'comments', 'community_reports', 'event_artists', 'event_follows',
      'event_genres', 'event_reports', 'events', 'favorites', 'genres', 'profiles', 'review_photos',
      'review_reports', 'review_votes', 'reviews', 'support_attachments', 'support_messages', 'support_tickets',
      'threads', 'venue_aliases', 'venues',
    ]);
    for (const row of r.rows) assert.equal(row.relrowsecurity, true, `${row.relname} has RLS`);
  });

  test('constraints reject bad data', async () => {
    await db.exec(`insert into public.venues (id, slug, name, area, lat, lng) values
      ('11111111-1111-4111-8111-111111111111', 'v', 'V', 'Centro', -20, -40)`);
    await assert.rejects(db.exec(`insert into public.venues (slug, name, area, lat, lng) values ('v', 'V2', 'Centro', -20, -40)`));
    await assert.rejects(db.exec(`insert into public.venues (slug, name, area, lat, lng, price_range) values ('v-bad-price', 'V3', 'Centro', -20, -40, '$$$$$')`));
    await assert.rejects(db.exec(`insert into public.venues (slug, name, area, lat, lng, image_url) values ('v-bad-img', 'V4', 'Centro', -20, -40, 'http://bad.example/a.jpg')`));
    await assert.rejects(db.exec(`insert into public.events (venue_id, title, starts_at, popularity) values
      ('11111111-1111-4111-8111-111111111111', 'x', now(), 101)`));
    await assert.rejects(db.exec(`insert into public.events (venue_id, title, starts_at, status) values
      ('11111111-1111-4111-8111-111111111111', 'x', now(), 'live')`));
    const r = await db.query<{ age_min: number; status: string }>(`insert into public.events (venue_id, title, starts_at)
      values ('11111111-1111-4111-8111-111111111111', 'x', now()) returning age_min, status`);
    assert.deepEqual(r.rows[0], { age_min: 18, status: 'draft' });
    await db.exec(`delete from public.venues`);
  });
});

describe('seed dataset', () => {
  test('ids are deterministic and independent of now', () => {
    const other = buildSeed(new Date('2027-03-01T03:00:00Z'));
    assert.deepEqual(other.events.map((e) => e.id).sort(), ds.events.map((e) => e.id).sort());
    assert.deepEqual(other.venues.map((v) => v.id), ds.venues.map((v) => v.id));
    assert.equal(uuidFromSlug('venue:bolt'), ds.venues.find((v) => v.slug === 'bolt')!.id);
    for (const e of ds.events) assert.match(e.id, /^[0-9a-f]{8}-[0-9a-f]{4}-3[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  test('has >= 200 valid, deduplicated venues and preserves docs/VENUES.md pilot invariants', () => {
    assert.equal(ds.genres.length, 10);
    assert.ok(ds.venues.length >= 200, `venues=${ds.venues.length}`);
    const genreSet = new Set(ds.genres.map((g) => g.slug));
    for (const v of ds.venues) {
      const check = validateVenue(v, genreSet);
      assert.equal(check.ok, true, `venue ${v.slug} invalid: ${check.ok ? '' : check.errors.join(', ')}`);
    }
    const deduped = dedupeVenues(ds.venues);
    assert.equal(deduped.duplicates.length, 0, 'zero duplicate venues');
    assert.equal(deduped.unique.length, ds.venues.length);

    assert.ok(ds.venues.every((v) => v.placeholder));
    assert.ok(!ds.venues.some((v) => /sinner/i.test(v.name)));
    const bySlug = new Map(ds.venues.map((v) => [v.slug, v]));
    assert.equal(bySlug.get('casa-caipora')!.status, 'closed');
    assert.equal(bySlug.get('fluente')!.status, 'unverified');
    assert.equal(bySlug.get('correria-music-bar')!.area, 'Vila Velha');
    assert.ok(bySlug.has('casa-mare'));
    const caiporaId = bySlug.get('casa-caipora')!.id;
    assert.ok(!ds.events.some((e) => e.venueId === caiporaId && Date.parse(e.startsAt) >= now), 'no upcoming at Caipora');
    const upcoming = ds.events.filter((e) => Date.parse(e.startsAt) >= now);
    const past = ds.events.filter((e) => Date.parse(e.startsAt) < now);
    assert.ok(upcoming.length >= 250, `upcoming=${upcoming.length}`);
    assert.ok(past.length >= 100, `past=${past.length}`);
    for (const e of upcoming) assert.ok(Date.parse(e.startsAt) - now <= 29 * 86_400_000);
    for (const e of past) assert.ok(now - Date.parse(e.startsAt) <= 183 * 86_400_000);
    assert.ok(ds.artists.length >= 60);
    for (const e of ds.events) {
      if (e.priceMax !== null) assert.ok(e.priceMax <= 60);
      if (!e.isFree) assert.equal(e.ticketUrl, `https://example.com/ingressos/${e.ticketUrl!.split('/').pop()}`);
      assert.ok(e.artistIds.length > 0);
    }
  });

  test('seed SQL upserts idempotently across repeated runs with zero duplicates', async () => {
    const sql = datasetToSql(ds);
    await db.exec(sql);
    await db.exec(sql); // Second run must succeed cleanly with identical counts.
    const n = async (t: string) => Number((await db.query<{ n: number }>(`select count(*)::int n from public.${t}`)).rows[0].n);
    assert.equal(await n('genres'), ds.genres.length);
    assert.equal(await n('venues'), ds.venues.length);
    assert.ok((await n('venues')) >= 200);
    assert.equal(await n('artists'), ds.artists.length);
    assert.equal(await n('events'), ds.events.length);
    assert.equal(await n('event_artists'), ds.events.reduce((s, e) => s + e.artistIds.length, 0));
  });

  test('generated seed.sql, app/src/data/seed.json, and public feed exist and agree on ids', () => {
    const json = JSON.parse(readFileSync(path.join(REPO_ROOT, 'app', 'src', 'data', 'seed.json'), 'utf8')) as SeedDataset;
    const feed = JSON.parse(readFileSync(path.join(REPO_ROOT, 'app', 'public', 'feed', 'v1', 'events.json'), 'utf8')) as SeedDataset;
    const sql = readFileSync(path.join(REPO_ROOT, 'supabase', 'seed', 'seed.sql'), 'utf8');
    assert.ok(json.venues.length >= 200);
    assert.equal(feed.venues.length, json.venues.length);
    assert.deepEqual(json.events.map((e) => e.id).sort(), ds.events.map((e) => e.id).sort());
    for (const v of json.venues) assert.ok(sql.includes(v.id));
    for (const e of json.events) assert.ok(sql.includes(e.id));
  });
});

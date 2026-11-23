/**
 * Seed generator. Run from app/:  npm run seed            (seed.sql + app/src/data/seed.json + public/feed/v1/* + ingest/data/venues.json)
 *                                 npm run seed -- --fixtures  (also test fixtures)
 *
 * Fixtures: dataset with `now` fixed to 2026-10-23T12:00:00Z plus search cases whose
 * expected results are computed by running search_events in PGlite (SQL is the oracle).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { SearchParams, SeedDataset } from '../../app/src/domain/types';
import { DEFAULT_LOCATION } from '../../app/src/domain/types';
import { localFallbackCoverPath } from '../../app/src/domain/cover';
import { dedupeVenues, validateVenue } from '../../app/src/domain/venueSchema';
import { artistId, buildSeed } from './seed-data';
import { datasetToSql } from './sql';

const ROOT = path.resolve(__dirname, '..', '..');
const SEED_SQL = path.join(ROOT, 'supabase', 'seed', 'seed.sql');
const SEED_JSON = path.join(ROOT, 'app', 'src', 'data', 'seed.json');
const FEED_DIR = path.join(ROOT, 'app', 'public', 'feed', 'v1');
const FEED_EVENTS = path.join(FEED_DIR, 'events.json');
const FEED_VENUES = path.join(FEED_DIR, 'venues.json');
const FEED_META = path.join(FEED_DIR, 'meta.json');
const INGEST_VENUES = path.join(ROOT, 'ingest', 'data', 'venues.json');
const FIXTURES = path.join(ROOT, 'supabase', 'tests', 'fixtures');

export const FIXED_NOW_ISO = '2026-10-23T12:00:00.000Z';

export interface SearchCase {
  name: string;
  params: SearchParams;
  expectedEventIds: string[];
  expectedTotal: number;
}

const write = (file: string, content: string) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content, 'utf8');
  console.log(`wrote ${path.relative(ROOT, file)}`);
};
const json = (v: unknown) => JSON.stringify(v, null, 2) + '\n';
const compactJson = (v: unknown) => JSON.stringify(v) + '\n';

/** Search case definitions (params only). Expectations come from SQL. */
export function searchCaseParams(now: string): { name: string; params: SearchParams }[] {
  const base = { lat: DEFAULT_LOCATION.lat, lng: DEFAULT_LOCATION.lng, radiusKm: 30, now };
  const c = (name: string, params: Partial<SearchParams>) => ({
    name,
    params: { ...base, sort: 'date' as const, ...params },
  });
  return [
    c('default: published upcoming, not closed, by date', {}),
    c('sort distance', { sort: 'distance' }),
    c('sort price (free first, null price last)', { sort: 'price', limit: 50 }),
    c('sort popularity desc', { sort: 'popularity' }),
    c('all results in one page', { limit: 100 }),
    c('radius 1 km around Praia do Canto', { radiusKm: 1, limit: 50 }),
    c('radius 4 km excludes Vila Velha and Centro', { radiusKm: 4, sort: 'distance', limit: 50 }),
    c('radius 0 km', { radiusKm: 0 }),
    c('genre pagode-samba', { genreSlugs: ['pagode-samba'], limit: 50 }),
    c('genres funk OR metal-punk-goth', { genreSlugs: ['funk', 'metal-punk-goth'], limit: 50 }),
    c('empty genre list = no filter', { genreSlugs: [], limit: 5 }),
    c('tag acessivel (venue tag)', { tags: ['acessivel'], limit: 100 }),
    c('tags lgbtqia AND vegano', { tags: ['lgbtqia', 'vegano'], limit: 100 }),
    c('tag pet-friendly (venue and event override)', { tags: ['pet-friendly'], limit: 100 }),
    c('empty tag list = no filter', { tags: [], limit: 5 }),
    c('priceMax 0 = only free', { priceMax: 0, limit: 50 }),
    c('priceMax 20', { priceMax: 20, sort: 'price', limit: 50 }),
    c('priceMax 35', { priceMax: 35, limit: 50 }),
    c('date range: next 3 days', {
      dateFrom: now,
      dateTo: new Date(Date.parse(now) + 3 * 86_400_000).toISOString(),
      limit: 50,
    }),
    c('dateFrom in the past overrides now', {
      dateFrom: new Date(Date.parse(now) - 14 * 86_400_000).toISOString(),
      dateTo: new Date(Date.parse(now) + 2 * 86_400_000).toISOString(),
      limit: 50,
    }),
    c('artist DJ Caju', { artistId: artistId('dj-caju'), limit: 50 }),
    c('artist Maria Goiaba by popularity', { artistId: artistId('maria-goiaba'), sort: 'popularity' }),
    c('area centro (case-insensitive)', { area: 'centro', limit: 50 }),
    c('area Vila Velha', { area: 'Vila Velha', limit: 50 }),
    c('area Vila Velha with small radius', { area: 'Vila Velha', radiusKm: 5 }),
    c('query "pagodao" (accent-insensitive title)', { query: 'pagodao' }),
    c('query "MARE" (venue name, accents)', { query: 'MARE', limit: 50 }),
    c('query "noctambulos" (artist name)', { query: 'noctambulos' }),
    c('query "  selva " trimmed', { query: '  selva ', limit: 50 }),
    c('query "Ferrugem Atômica" exact accents', { query: 'Ferrugem Atômica' }),
    c('query no results', { query: 'zzz-nada' }),
    c('pagination page 1 (limit 5)', { limit: 5 }),
    c('pagination page 2 (limit 5, cursor 5)', { limit: 5, cursor: '5' }),
    c('pagination last partial page', { limit: 7, cursor: '35' }),
    c('combined: funk|pop-hits, <= 40, Jardim da Penha, by popularity', {
      genreSlugs: ['funk', 'pop-hits'], priceMax: 40, area: 'jardim da penha', sort: 'popularity', limit: 50,
    }),
    c('combined: query "dj" + distance', { query: 'dj', sort: 'distance', limit: 50 }),
  ];
}

async function computeCases(ds: SeedDataset): Promise<SearchCase[]> {
  // Imported lazily so plain `npm run seed` does not boot Postgres.
  const { createDb, search } = await import('../tests/harness');
  const db = await createDb(ds);
  const cases: SearchCase[] = [];
  for (const { name, params } of searchCaseParams(ds.generatedAt)) {
    const r = await search(db, params);
    cases.push({ name, params, expectedEventIds: r.ids, expectedTotal: r.total });
  }
  await db.close();
  return cases;
}

function assertCatalogQuality(ds: SeedDataset): void {
  const genreSlugs = new Set(ds.genres.map((g) => g.slug));
  for (const v of ds.venues) {
    const check = validateVenue(v, genreSlugs);
    if (!check.ok) throw new Error(`Catalog validation failed for ${v.slug}: ${check.errors.join(', ')}`);
  }
  const { unique, duplicates } = dedupeVenues(ds.venues);
  if (duplicates.length > 0) throw new Error(`Catalog contains ${duplicates.length} duplicate venues`);
  if (unique.length < 200) throw new Error(`Expected >= 200 valid unique venues, got ${unique.length}`);
}

function buildMetaPayload(ds: SeedDataset, nowMs: number) {
  return {
    generatedAt: ds.generatedAt,
    counts: {
      events: ds.events.length,
      upcoming: ds.events.filter((e) => e.status === 'published' && Date.parse(e.endsAt ?? e.startsAt) >= nowMs).length,
      cancelled: ds.events.filter((e) => e.status === 'cancelled').length,
      venues: ds.venues.length,
      artists: ds.artists.length,
    },
    sources: { seed: ds.events.length },
    schemaVersion: 1,
  };
}

function buildLeanVenuesFeed(ds: SeedDataset) {
  return {
    generatedAt: ds.generatedAt,
    total: ds.venues.length,
    venues: ds.venues.map((v) => ({
      id: v.id,
      slug: v.slug,
      name: v.name,
      area: v.area,
      city: v.city,
      uf: v.uf ?? 'ES',
      lat: v.lat,
      lng: v.lng,
      status: v.status,
      genreSlugs: v.genreSlugs,
      priceRange: v.priceRange ?? '$$',
      hours: v.hours,
      coverKey: v.coverKey,
      fallbackCover: localFallbackCoverPath(v.genreSlugs),
      updatedAt: v.updatedAt ?? ds.generatedAt,
    })),
  };
}

function buildIngestVenues(ds: SeedDataset) {
  const pilotAliases: Record<string, string[]> = {
    bolt: ['Bolt Vitória', 'Bolt Antimofo', 'Bolt Bar'],
    'a-selva': ['Selva', 'A Selva Vitória', 'Selva Casa de Eventos'],
    gordinho: ['Gordinho Praia do Canto', 'Gordinho Bar'],
    'pub-426': ['426', 'Pub426', 'Pub 426 Vitória'],
    fluente: ['Fluente Vitória', 'Fluente Bar'],
    'correria-music-bar': ['Correria', 'Correria Bar'],
    'casa-caipora': ['Caipora'],
  };
  return ds.venues.map((v) => ({
    id: v.slug,
    name: v.name,
    aliases: pilotAliases[v.slug] ?? [`${v.name} ${v.area}`, `${v.name} ${v.city}`],
    address: v.address ?? `${v.area}, ${v.city}`,
    area: v.area,
    city: v.city,
    lat: v.lat,
    lng: v.lng,
    genreSlugs: v.genreSlugs,
    status: v.status,
    hours: v.hours,
  }));
}

async function main() {
  const withFixtures = process.argv.includes('--fixtures');
  const nowIdx = process.argv.indexOf('--now');
  const now = nowIdx !== -1 && process.argv[nowIdx + 1] ? new Date(process.argv[nowIdx + 1]) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error('Invalid --now timestamp');

  const ds = buildSeed(now);
  assertCatalogQuality(ds);

  write(SEED_SQL, datasetToSql(ds));
  write(SEED_JSON, json(ds));
  write(FEED_EVENTS, compactJson(ds));
  write(FEED_VENUES, compactJson(buildLeanVenuesFeed(ds)));
  write(FEED_META, json(buildMetaPayload(ds, now.getTime())));
  write(INGEST_VENUES, json(buildIngestVenues(ds)));

  console.log(`catalog verified: ${ds.venues.length} unique valid venues, ${ds.artists.length} artists, ${ds.events.length} events`);

  if (withFixtures) {
    const fixed = buildSeed(new Date(FIXED_NOW_ISO));
    assertCatalogQuality(fixed);
    write(path.join(FIXTURES, 'seed-fixed.json'), json(fixed));
    const cases = await computeCases(fixed);
    write(path.join(FIXTURES, 'search-cases.json'), json(cases));
    console.log(`${cases.length} search cases`);
  }
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});

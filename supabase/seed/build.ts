/**
 * Seed generator. Run from app/:  npm run seed            (seed.sql + app/src/data/seed.json)
 *                                 npm run seed -- --fixtures  (also test fixtures)
 *
 * Fixtures: dataset with `now` fixed to 2026-10-23T12:00:00Z plus search cases whose
 * expected results are computed by running search_events in PGlite (SQL is the oracle).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { SearchParams, SeedDataset } from '../../app/src/domain/types';
import { DEFAULT_LOCATION } from '../../app/src/domain/types';
import { artistId, buildSeed } from './seed-data';
import { datasetToSql } from './sql';

const ROOT = path.resolve(__dirname, '..', '..');
const SEED_SQL = path.join(ROOT, 'supabase', 'seed', 'seed.sql');
const SEED_JSON = path.join(ROOT, 'app', 'src', 'data', 'seed.json');
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

async function main() {
  const withFixtures = process.argv.includes('--fixtures');

  const ds = buildSeed(new Date());
  write(SEED_SQL, datasetToSql(ds));
  write(SEED_JSON, json(ds));

  if (withFixtures) {
    const fixed = buildSeed(new Date(FIXED_NOW_ISO));
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

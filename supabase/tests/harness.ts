/**
 * Local Postgres harness on PGlite (Postgres WASM). No network, no Supabase.
 * Recreates the bits of Supabase the migrations depend on: roles anon /
 * authenticated / service_role and a stub `auth` schema.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import type { SearchParams, SeedDataset } from '../../app/src/domain/types';
import { datasetToSql } from '../seed/sql';

export const REPO_ROOT = path.resolve(__dirname, '..', '..');
export const SUPABASE_DIR = path.join(REPO_ROOT, 'supabase');
export const MIGRATIONS_DIR = path.join(SUPABASE_DIR, 'migrations');
export const FIXTURES_DIR = path.join(SUPABASE_DIR, 'tests', 'fixtures');
export const FIXED_NOW = '2026-10-23T12:00:00.000Z';

// Dependencies live in app/node_modules (supabase/ has no package.json).
const appRequire = createRequire(path.join(REPO_ROOT, 'app', 'package.json'));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PGlite } = appRequire('@electric-sql/pglite') as typeof import('@electric-sql/pglite');
export type DB = InstanceType<typeof PGlite>;

export const SUPABASE_STUB_SQL = `
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
`;

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort()
    .map((f) => path.join(MIGRATIONS_DIR, f));
}

export async function createDb(seed?: SeedDataset): Promise<DB> {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB_SQL);
  for (const file of migrationFiles()) {
    try {
      await db.exec(readFileSync(file, 'utf8'));
    } catch (err) {
      throw new Error(`migration ${path.basename(file)} failed: ${(err as Error).message}`);
    }
  }
  if (seed) await db.exec(datasetToSql(seed));
  return db;
}

/** Run `fn` as a Supabase role, optionally with a JWT subject (auth.uid()). */
export async function asRole<T>(
  db: DB,
  role: 'anon' | 'authenticated' | 'service_role',
  sub: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [sub ?? '']);
  await db.exec(`set role ${role}`);
  try {
    return await fn();
  } finally {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}

export interface SearchRow {
  id: string;
  title: string;
  starts_at: Date;
  price_min: string | number | null;
  is_free: boolean;
  popularity: number;
  genre_slugs: string[];
  artist_ids: string[];
  venue_name: string;
  venue_area: string;
  venue_status: string;
  distance_km: number;
  total_count: number;
}

export interface SearchResult {
  ids: string[];
  total: number;
  rows: SearchRow[];
}

/** Map domain SearchParams (cursor = String(offset)) to the search_events RPC. */
export function searchArgs(p: SearchParams): unknown[] {
  return [
    p.lat,
    p.lng,
    p.radiusKm,
    p.genreSlugs ?? null,
    p.priceMax ?? null,
    p.dateFrom ?? null,
    p.dateTo ?? null,
    p.artistId ?? null,
    p.area ?? null,
    p.query ?? null,
    p.sort,
    p.limit ?? 20,
    p.cursor ? Number(p.cursor) : 0,
    p.now ?? new Date().toISOString(),
  ];
}

export const SEARCH_SQL = `select * from public.search_events(
  p_lat => $1, p_lng => $2, p_radius_km => $3, p_genre_slugs => $4::text[],
  p_price_max => $5::numeric, p_date_from => $6::timestamptz, p_date_to => $7::timestamptz,
  p_artist_id => $8::uuid, p_area => $9, p_query => $10, p_sort => $11,
  p_limit => $12, p_offset => $13, p_now => $14::timestamptz)`;

export async function search(db: DB, p: SearchParams): Promise<SearchResult> {
  const res = await db.query<SearchRow>(SEARCH_SQL, searchArgs(p));
  const rows = res.rows;
  let total = rows.length ? Number(rows[0].total_count) : 0;
  if (!rows.length && p.cursor && Number(p.cursor) > 0) {
    // Page past the end: ask for the first row only to learn the total.
    const probe = await db.query<SearchRow>(SEARCH_SQL, searchArgs({ ...p, cursor: '0', limit: 1 }));
    total = probe.rows.length ? Number(probe.rows[0].total_count) : 0;
  }
  return { ids: rows.map((r) => r.id), total, rows };
}

export function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

export function fixtureExists(name: string): boolean {
  return existsSync(path.join(FIXTURES_DIR, name));
}

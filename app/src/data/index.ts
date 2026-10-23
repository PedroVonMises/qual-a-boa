import { env } from '@/lib/env';
import type { SeedDataset } from '@/domain/types';
import type { Repo } from './repo';
import { SeedRepo } from './seedRepo';
import { SupabaseRepo } from './supabaseRepo';

export type { Repo } from './repo';
export { SeedRepo } from './seedRepo';
export { SupabaseRepo, RepoError } from './supabaseRepo';

let instance: Repo | null = null;

/** Builds the repo for the configured data source. seed.json is produced by `npm run seed`. */
export function createRepo(source = env.dataSource): Repo {
  if (source === 'supabase') return new SupabaseRepo(env.supabaseUrl, env.supabaseAnonKey);
  const dataset = require('./seed.json') as SeedDataset;
  return new SeedRepo(dataset);
}

export function getRepo(): Repo {
  if (!instance) instance = createRepo();
  return instance;
}

/** Test hook: inject or reset the singleton. */
export function setRepo(repo: Repo | null): void {
  instance = repo;
}

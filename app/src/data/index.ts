import { DEFAULT_FEED_URL, env } from '@/lib/env';
import type { SeedDataset } from '@/domain/types';
import type { Repo } from './repo';
import { FeedRepo } from './feedRepo';
import { SeedRepo } from './seedRepo';
import { SupabaseRepo } from './supabaseRepo';

export type { Repo } from './repo';
export { FeedRepo } from './feedRepo';
export { SeedRepo } from './seedRepo';
export { SupabaseRepo, RepoError } from './supabaseRepo';

let instance: Repo | null = null;

/** Builds the repo for the configured data source. seed.json is produced by `npm run seed`. */
export function createRepo(source = env.dataSource): Repo {
  if (source === 'supabase') return new SupabaseRepo(env.supabaseUrl, env.supabaseAnonKey);
  const dataset = require('./seed.json') as SeedDataset;
  if (source === 'feed') {
    // Starts on the bundled seed; the persisted copy and the network feed are swapped in asynchronously.
    const feed = new FeedRepo({ seed: dataset, url: env.feedUrl || DEFAULT_FEED_URL });
    void feed.start();
    return feed;
  }
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

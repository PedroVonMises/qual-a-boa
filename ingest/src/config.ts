import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface Paths {
  /** ingest/ */
  root: string;
  /** curated/, links.txt, approved.json (and optional venues.json / genre-keywords.json overrides). */
  dataDir: string;
  /** Fallback for venues.json / genre-keywords.json when dataDir lacks them. */
  defaultDataDir: string;
  outDir: string;
  /** app/public/feed/v1 */
  feedDir: string;
  cacheDir: string;
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function resolvePaths(o: Partial<Pick<Paths, 'dataDir' | 'outDir' | 'feedDir' | 'cacheDir'>> = {}): Paths {
  const env = process.env;
  return {
    root: ROOT,
    defaultDataDir: join(ROOT, 'data'),
    dataDir: resolve(o.dataDir ?? env.INGEST_DATA_DIR ?? join(ROOT, 'data')),
    outDir: resolve(o.outDir ?? env.INGEST_OUT_DIR ?? join(ROOT, 'out')),
    feedDir: resolve(o.feedDir ?? env.INGEST_FEED_DIR ?? join(ROOT, '..', 'app', 'public', 'feed', 'v1')),
    cacheDir: resolve(o.cacheDir ?? env.INGEST_CACHE_DIR ?? join(ROOT, '.cache')),
  };
}

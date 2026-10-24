// `npm run demo`: runs the real CLI end to end on the synthetic fixtures, offline (cache seeded from hand-written pages),
// writing into a temp dir. Prints the outputs and validates the feed. Never touches app/public/feed or the network.
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { validateFeed } from '../src/publish.js';
import { prepareData, seedCache } from './helpers.js';

const dir = await mkdtemp(join(tmpdir(), 'ingest-demo-'));
const [data, out, feed, cache] = ['data', 'out', 'feed', 'cache'].map((d) => join(dir, d)) as [string, string, string, string];
await prepareData(data, []);
await seedCache(cache);

const cli = ['--import', 'tsx', 'src/cli.ts'];
const flags = ['--data', data, '--out', out, '--feed', feed, '--cache', cache, '--offline', '--now', '2026-11-01T12:00:00Z'];
console.log(execFileSync(process.execPath, [...cli, 'run', ...flags], { encoding: 'utf8' }));
console.log(execFileSync(process.execPath, [...cli, 'check', ...flags], { encoding: 'utf8' }));

const events = JSON.parse(await readFile(join(feed, 'events.json'), 'utf8'));
const meta = JSON.parse(await readFile(join(feed, 'meta.json'), 'utf8'));
const errs = validateFeed(events);
console.log('meta.json:', JSON.stringify(meta));
console.log(`events.json: ${events.events.length} events, ${events.venues.length} venues, ${events.artists.length} artists, schema errors: ${errs.length}`);
console.log('files in', dir);
if (errs.length) {
  console.error('FAILED:', errs.join('; '));
  process.exitCode = 1;
}

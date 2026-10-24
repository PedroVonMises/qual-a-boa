// Usage:
//   tsx src/cli.ts run   [--data DIR] [--out DIR] [--feed DIR] [--cache DIR] [--offline] [--fresh] [--geocode] [--now ISO]
//   tsx src/cli.ts add   <https-url> [--data DIR]
//   tsx src/cli.ts check [same dir flags]   (no writes, no network: validates data files and the current feed)
import { addLink } from './adapters/link.js';
import { resolvePaths } from './config.js';
import { runPipeline, type RunOptions } from './pipeline.js';

function parseArgs(argv: string[]) {
  const flags = new Map<string, string | true>();
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith('--')) {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--') && ['data', 'out', 'feed', 'cache', 'now'].includes(a.slice(2))) {
        flags.set(a.slice(2), next);
        i++;
      } else flags.set(a.slice(2), true);
    } else positional.push(a);
  }
  return { flags, positional };
}

function runOptions(flags: Map<string, string | true>): RunOptions {
  const s = (k: string) => (typeof flags.get(k) === 'string' ? (flags.get(k) as string) : undefined);
  const paths: NonNullable<RunOptions['paths']> = {};
  const keys = { data: 'dataDir', out: 'outDir', feed: 'feedDir', cache: 'cacheDir' } as const;
  for (const k of Object.keys(keys) as (keyof typeof keys)[]) {
    const v = s(k);
    if (v) paths[keys[k]] = v;
  }
  const now = s('now') ?? process.env.INGEST_NOW;
  return {
    paths,
    ...(now && { now: new Date(now) }),
    offline: flags.has('offline') || process.env.INGEST_OFFLINE === '1',
    fresh: flags.has('fresh') || process.env.INGEST_FRESH === '1',
    geocode: flags.has('geocode') || process.env.INGEST_GEOCODE === '1',
    log: (m) => console.log(`[ingest] ${m}`),
  };
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const { flags, positional } = parseArgs(rest);
  switch (cmd) {
    case 'add': {
      const url = positional[0];
      if (!url) throw new Error('usage: ingest add <https-url>');
      const paths = resolvePaths(typeof flags.get('data') === 'string' ? { dataDir: flags.get('data') as string } : {});
      const r = await addLink(paths.dataDir, url);
      console.log(r.added ? `added ${r.url}` : `already listed: ${r.url}`);
      return;
    }
    case 'run': {
      const r = await runPipeline(runOptions(flags));
      console.log(r.prTitle);
      console.log(`events: ${r.meta.counts.events} (upcoming ${r.meta.counts.upcoming}), venues: ${r.meta.counts.venues}, pending approval: ${r.pending.length}, needs review: ${r.needsReview.length}, skipped: ${r.skipped.length}`);
      return;
    }
    case 'check': {
      const o = runOptions(flags);
      const r = await runPipeline({ ...o, offline: true, write: false, loadOptionalAdapters: false });
      for (const n of r.needsReview) console.log(`needs-review: ${n.source} ${n.ref}: ${n.reason}`);
      for (const p of r.problems) console.log(`INVALID: ${p}`);
      console.log(`${r.candidates.length} candidates, ${r.pending.length} pending approval, ${r.needsReview.length} needing review, feed problems: ${r.problems.length}`);
      if (r.problems.length) process.exitCode = 1;
      return;
    }
    default:
      console.error('usage: ingest <run|add|check> [options]  (see ingest/README.md)');
      process.exitCode = 2;
  }
}

main().catch((e) => {
  console.error(`FAILED: ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
});

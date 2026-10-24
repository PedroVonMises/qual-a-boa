// Adapter registry. `manual` and `link` are built in. `sympla-api` and `crawler` (agent E) are loaded lazily and
// optionally: if the module is absent the pipeline simply runs without it.
//
// Contract for optional modules: export `createAdapter(opts: AdapterFactoryOptions): SourceAdapter` (preferred) or a
// default/`adapter` export that is a SourceAdapter. An adapter may also expose `report?: AdapterReport`.
import type { SourceAdapter } from '../types.js';
import type { FetchFn } from '../http.js';
import { createLinkAdapter } from './link.js';
import { createManualAdapter } from './manual.js';
import type { AdapterReport } from './report.js';

export interface AdapterFactoryOptions {
  dataDir: string;
  cacheDir: string;
  offline: boolean;
  fetchImpl?: FetchFn;
  sleep?: (ms: number) => Promise<void>;
  /** When false (tests) optional adapters are never imported. */
  loadOptional: boolean;
  log: (m: string) => void;
}

export type ReportingAdapter = SourceAdapter & { report?: AdapterReport };

const OPTIONAL_MODULES = ['./sympla-api.js', './crawler.js'];

async function loadOptional(name: string, opts: AdapterFactoryOptions): Promise<ReportingAdapter | null> {
  try {
    const spec = name; // variable specifier: no compile-time dependency on files owned by agent E
    const mod = (await import(spec)) as Record<string, unknown>;
    const make = mod.createAdapter as ((o: AdapterFactoryOptions) => ReportingAdapter) | undefined;
    const a = make ? make(opts) : ((mod.default ?? mod.adapter) as ReportingAdapter | undefined);
    return a && typeof a.fetch === 'function' ? a : null;
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code !== 'ERR_MODULE_NOT_FOUND' && code !== 'MODULE_NOT_FOUND') opts.log(`optional adapter ${name} failed to load: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

export async function buildAdapters(opts: AdapterFactoryOptions): Promise<ReportingAdapter[]> {
  const adapters: ReportingAdapter[] = [
    createManualAdapter(opts.dataDir),
    createLinkAdapter({
      dataDir: opts.dataDir,
      cacheDir: opts.cacheDir,
      offline: opts.offline,
      ...(opts.fetchImpl && { fetchImpl: opts.fetchImpl }),
      ...(opts.sleep && { sleep: opts.sleep }),
    }),
  ];
  if (opts.loadOptional) {
    for (const m of OPTIONAL_MODULES) {
      const a = await loadOptional(m, opts);
      if (a) adapters.push(a);
    }
  }
  return adapters;
}

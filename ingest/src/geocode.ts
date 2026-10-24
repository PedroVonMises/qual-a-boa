// Optional geocoding of unknown venues through Nominatim (OpenStreetMap). Usage policy: identify the app,
// at most 1 request/second, cache results, show attribution (README: "Geocoding by Nominatim, data (c) OpenStreetMap contributors").
// Off by default (`--geocode`); never used in tests.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { FetchFn } from './http.js';
import type { Geocoder } from './normalize.js';
import { USER_AGENT } from './types.js';

export function createNominatimGeocoder(opts: { cacheDir: string; fetchImpl?: FetchFn; sleep?: (ms: number) => Promise<void>; log?: (m: string) => void }): Geocoder {
  const fetchImpl = opts.fetchImpl ?? (globalThis.fetch as unknown as FetchFn);
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let last = 0;
  return async (query) => {
    const file = join(opts.cacheDir, 'geocode-' + createHash('sha1').update(query).digest('hex') + '.json');
    try {
      return JSON.parse(await readFile(file, 'utf8')) as { lat: number; lng: number } | null;
    } catch {
      /* miss */
    }
    const wait = last + 1100 - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`;
    let result: { lat: number; lng: number } | null = null;
    try {
      const res = await fetchImpl(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
      if (res.status === 200) {
        const arr = JSON.parse(await res.text()) as { lat: string; lon: string }[];
        const first = arr[0];
        if (first) result = { lat: Number(first.lat), lng: Number(first.lon) };
        if (result && (!Number.isFinite(result.lat) || !Number.isFinite(result.lng))) result = null;
      } else opts.log?.(`geocode: HTTP ${res.status}`);
    } catch (e) {
      opts.log?.(`geocode failed: ${e instanceof Error ? e.message : String(e)}`);
      return null; // do not cache transient failures
    }
    await mkdir(opts.cacheDir, { recursive: true });
    await writeFile(file, JSON.stringify(result));
    return result;
  };
}

// Test/demo helpers: synthetic pages, fake fetch, offline cache seeding. No real network anywhere.
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { FetchFn } from '../src/http.js';

export const FIXTURES = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures');
export const FIXTURE_DATA = join(FIXTURES, 'data');

export const U = {
  bolt: 'https://ingressos.example.com.br/evento/baile-do-bolt-novembro',
  selva: 'https://tickets.example.org/e/forro-da-selva-2026',
  rock: 'https://agenda.example.net/shows/rock-no-quintal',
  empty: 'https://agenda.example.net/shows/sem-dados',
  blocked: 'https://blocked.example.com/evento/festa-privada',
  gone: 'https://ingressos.example.com.br/evento/removido',
};

export const LINKS_TXT = Object.values(U).join('\n') + '\n';

const page = (name: string) => readFile(join(FIXTURES, 'pages', name), 'utf8');

export async function fixtureResponses(): Promise<Record<string, { status: number; body: string; type?: string }>> {
  return {
    'https://ingressos.example.com.br/robots.txt': { status: 200, body: 'User-agent: *\nDisallow: /admin/\n' },
    'https://tickets.example.org/robots.txt': { status: 404, body: '' },
    'https://agenda.example.net/robots.txt': { status: 200, body: 'User-agent: SomeOtherBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n' },
    'https://blocked.example.com/robots.txt': { status: 200, body: 'User-agent: *\nDisallow: /evento/\n' },
    [U.bolt]: { status: 200, body: await page('baile-bolt.html') },
    [U.selva]: { status: 200, body: await page('forro-selva.html') },
    [U.rock]: { status: 200, body: await page('rock-quintal.html') },
    [U.empty]: { status: 200, body: await page('sem-dados.html') },
    [U.gone]: { status: 404, body: 'not found' },
  };
}

export interface FakeFetch { fn: FetchFn; calls: { url: string; ua: string | undefined }[] }

export async function fakeFetch(overrides: Record<string, { status: number; body: string; type?: string }> = {}): Promise<FakeFetch> {
  const table = { ...(await fixtureResponses()), ...overrides };
  const calls: FakeFetch['calls'] = [];
  const fn: FetchFn = async (url, init) => {
    calls.push({ url, ua: init?.headers?.['User-Agent'] });
    const r = table[url];
    if (!r) throw new Error(`unexpected network request in test: ${url}`);
    return { status: r.status, headers: { get: (n: string) => (n.toLowerCase() === 'content-type' ? (r.type ?? 'text/html; charset=utf-8') : null) }, text: async () => r.body };
  };
  return { fn, calls };
}

/** Writes the fixture responses as an on-disk cache so the pipeline can run `--offline` (404 pages are cached as 404). */
export async function seedCache(cacheDir: string, fetchedAt = Date.now()): Promise<void> {
  await mkdir(cacheDir, { recursive: true });
  for (const [url, r] of Object.entries(await fixtureResponses())) {
    const name = createHash('sha1').update(url).digest('hex') + '.json';
    await writeFile(join(cacheDir, name), JSON.stringify({ url, status: r.status, fetchedAt, body: r.status < 400 ? r.body : '' }));
  }
}

/** Copies the fixture data dir (curated files) to `dest` and writes links.txt + approved.json. */
export async function prepareData(dest: string, approved: string[] = []): Promise<void> {
  await cp(FIXTURE_DATA, dest, { recursive: true });
  await writeFile(join(dest, 'links.txt'), LINKS_TXT);
  await writeFile(join(dest, 'approved.json'), JSON.stringify(approved));
}

export const FIXED_NOW = new Date('2026-11-01T12:00:00.000Z');

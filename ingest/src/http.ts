// Polite HTTP client: User-Agent, robots.txt (cached per host), 1 request / 2 s / host, on-disk response cache,
// stop on 403/429. `fetch` and `sleep` are injectable so tests never touch the network.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export type FetchFn = (url: string, init?: { headers?: Record<string, string>; redirect?: 'follow' | 'manual' }) => Promise<{
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}>;

export interface PoliteOptions {
  fetchImpl?: FetchFn;
  sleep?: (ms: number) => Promise<void>;
  nowMs?: () => number;
  userAgent: string;
  cacheDir: string;
  /** Cache-only mode: never touches the network, ignores TTL. Used by fixtures. */
  offline?: boolean;
  minIntervalMs?: number;
  cacheTtlMs?: number;
  log?: (m: string) => void;
}

export type PageResult =
  | { kind: 'ok'; status: number; body: string; fromCache: boolean }
  | { kind: 'gone'; status: number }
  | { kind: 'robots-disallowed' }
  | { kind: 'blocked'; status: number }
  | { kind: 'error'; reason: string };

const MAX_BODY = 2_000_000;

export interface RobotsRules {
  allows(path: string): boolean;
}

/** Parses robots.txt for our agent token (`qualaboabot`) falling back to `*`. Longest matching rule wins; Allow wins ties. */
export function parseRobots(text: string, agentToken = 'qualaboabot'): RobotsRules {
  type Group = { agents: string[]; rules: { allow: boolean; path: string }[] };
  const groups: Group[] = [];
  let cur: Group | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const i = line.indexOf(':');
    if (i < 0) continue;
    const key = line.slice(0, i).trim().toLowerCase();
    const val = line.slice(i + 1).trim();
    if (key === 'user-agent') {
      if (!cur || !lastWasAgent) {
        cur = { agents: [], rules: [] };
        groups.push(cur);
      }
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else if ((key === 'allow' || key === 'disallow') && cur) {
      lastWasAgent = false;
      if (val !== '' || key === 'allow') cur.rules.push({ allow: key === 'allow', path: val });
    } else {
      lastWasAgent = false;
    }
  }
  const specific = groups.filter((g) => g.agents.some((a) => a !== '*' && agentToken.includes(a)));
  const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes('*'));
  const rules = chosen.flatMap((g) => g.rules);
  const toRe = (p: string) => {
    const esc = p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp('^' + esc.replace(/\\\$$/, '$'));
  };
  return {
    allows(path: string) {
      let best: { allow: boolean; len: number } | null = null;
      for (const r of rules) {
        if (r.path === '') continue;
        if (toRe(r.path).test(path)) {
          if (!best || r.path.length > best.len || (r.path.length === best.len && r.allow)) best = { allow: r.allow, len: r.path.length };
        }
      }
      return best ? best.allow : true;
    },
  };
}

interface CacheEntry {
  url: string;
  status: number;
  fetchedAt: number;
  body: string;
}

export class PoliteClient {
  private robots = new Map<string, RobotsRules | 'deny'>();
  private lastRequest = new Map<string, number>();
  private blockedHosts = new Set<string>();
  readonly requestsMade: string[] = [];
  private readonly o: Required<Pick<PoliteOptions, 'minIntervalMs' | 'cacheTtlMs'>> & PoliteOptions;

  constructor(opts: PoliteOptions) {
    this.o = { minIntervalMs: 2000, cacheTtlMs: 6 * 3600_000, ...opts };
  }

  private now() {
    return (this.o.nowMs ?? Date.now)();
  }
  private sleep(ms: number) {
    return (this.o.sleep ?? ((m: number) => new Promise<void>((r) => setTimeout(r, m))))(ms);
  }
  private cachePath(url: string) {
    return join(this.o.cacheDir, createHash('sha1').update(url).digest('hex') + '.json');
  }
  private async readCache(url: string, ignoreTtl: boolean): Promise<CacheEntry | null> {
    try {
      const e = JSON.parse(await readFile(this.cachePath(url), 'utf8')) as CacheEntry;
      if (ignoreTtl || this.now() - e.fetchedAt < this.o.cacheTtlMs) return e;
    } catch {
      /* miss */
    }
    return null;
  }
  private async writeCache(e: CacheEntry) {
    try {
      await mkdir(this.o.cacheDir, { recursive: true });
      await writeFile(this.cachePath(e.url), JSON.stringify(e));
    } catch {
      /* cache is best effort */
    }
  }

  /** One network request, rate-limited per host. */
  private async rawGet(url: string): Promise<{ status: number; body: string; contentType: string } | { error: string }> {
    const fetchImpl = this.o.fetchImpl ?? (globalThis.fetch as unknown as FetchFn);
    const host = new URL(url).host;
    const last = this.lastRequest.get(host);
    if (last !== undefined) {
      const wait = last + this.o.minIntervalMs - this.now();
      if (wait > 0) await this.sleep(wait);
    }
    this.lastRequest.set(host, this.now());
    this.requestsMade.push(url);
    try {
      const res = await fetchImpl(url, {
        headers: { 'User-Agent': this.o.userAgent, Accept: 'text/html,application/xhtml+xml,text/plain;q=0.8' },
        redirect: 'follow',
      });
      const body = (await res.text()).slice(0, MAX_BODY);
      return { status: res.status, body, contentType: res.headers.get('content-type') ?? '' };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }

  private async robotsFor(origin: string): Promise<RobotsRules | 'deny'> {
    const hit = this.robots.get(origin);
    if (hit) return hit;
    const url = `${origin}/robots.txt`;
    let rules: RobotsRules | 'deny';
    const cached = await this.readCache(url, !!this.o.offline);
    if (cached) {
      rules = cached.status >= 500 ? 'deny' : cached.status >= 400 ? { allows: () => true } : parseRobots(cached.body);
    } else if (this.o.offline) {
      rules = 'deny'; // unknown robots in offline mode: refuse rather than assume
    } else {
      const r = await this.rawGet(url);
      if ('error' in r) rules = 'deny';
      else {
        await this.writeCache({ url, status: r.status, fetchedAt: this.now(), body: r.status < 400 ? r.body : '' });
        rules = r.status >= 500 ? 'deny' : r.status >= 400 ? { allows: () => true } : parseRobots(r.body);
      }
    }
    this.robots.set(origin, rules);
    return rules;
  }

  async get(url: string): Promise<PageResult> {
    let u: URL;
    try {
      u = new URL(url);
    } catch {
      return { kind: 'error', reason: 'invalid url' };
    }
    if (u.protocol !== 'https:') return { kind: 'error', reason: 'only https urls are fetched' };
    if (this.blockedHosts.has(u.host)) return { kind: 'blocked', status: 429 };
    const rules = await this.robotsFor(u.origin);
    if (rules === 'deny' || !rules.allows(u.pathname + u.search)) return { kind: 'robots-disallowed' };

    const cached = await this.readCache(url, !!this.o.offline);
    if (cached) {
      if (cached.status === 404 || cached.status === 410) return { kind: 'gone', status: cached.status };
      return { kind: 'ok', status: cached.status, body: cached.body, fromCache: true };
    }
    if (this.o.offline) return { kind: 'error', reason: 'offline and not in cache' };

    const r = await this.rawGet(url);
    if ('error' in r) return { kind: 'error', reason: r.error };
    if (r.status === 403 || r.status === 429) {
      this.blockedHosts.add(u.host);
      this.o.log?.(`stop: ${u.host} answered ${r.status}`);
      return { kind: 'blocked', status: r.status };
    }
    if (r.status === 404 || r.status === 410) return { kind: 'gone', status: r.status };
    if (r.status >= 400) return { kind: 'error', reason: `http ${r.status}` };
    if (r.contentType && !/html|xml|text/i.test(r.contentType)) return { kind: 'error', reason: `unexpected content-type ${r.contentType}` };
    await this.writeCache({ url, status: r.status, fetchedAt: this.now(), body: r.body });
    return { kind: 'ok', status: r.status, body: r.body, fromCache: false };
  }
}

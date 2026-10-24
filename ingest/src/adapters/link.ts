// Tier 2: public event pages listed in links.txt. Reads JSON-LD `Event`, falls back to OpenGraph / <title> / <time>.
// Anything that cannot be read with confidence becomes a needs-review record, never a guessed event.
import { readFile, appendFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { parse, type HTMLElement } from 'node-html-parser';

import { PoliteClient, type PoliteOptions } from '../http.js';
import { clean } from '../text.js';
import { looksFree, parseBRL, toOffsetISO } from '../parse.js';
import { shortHash } from '../ids.js';
import { USER_AGENT, type FetchContext, type RawEvent, type RawStatus, type SourceAdapter } from '../types.js';
import { emptyReport, type AdapterReport } from './report.js';

export const LINK_SOURCE = 'link';

export function canonicalUrl(url: string): string {
  const u = new URL(url);
  u.hash = '';
  for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(k)) u.searchParams.delete(k);
  return u.toString();
}
export const linkSourceId = (url: string) => shortHash(canonicalUrl(url));

export function parseLinksFile(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, '').trim();
    if (!line || line.startsWith('#')) continue;
    try {
      const u = new URL(line);
      if (u.protocol === 'https:') out.push(canonicalUrl(line));
    } catch {
      /* ignore invalid lines */
    }
  }
  return [...new Set(out)];
}

/** `ingest add <url>`: validates and appends to links.txt (no duplicates). Returns true when added. */
export async function addLink(dataDir: string, url: string): Promise<{ added: boolean; url: string }> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new Error(`not a valid url: ${url}`);
  }
  if (u.protocol !== 'https:') throw new Error('only https:// links are accepted');
  const canon = canonicalUrl(url);
  const file = join(dataDir, 'links.txt');
  let existing = '';
  try {
    existing = await readFile(file, 'utf8');
  } catch {
    await mkdir(dirname(file), { recursive: true });
  }
  if (parseLinksFile(existing).includes(canon)) return { added: false, url: canon };
  const prefix = existing.length && !existing.endsWith('\n') ? '\n' : '';
  await appendFile(file, `${prefix}${canon}\n`);
  return { added: true, url: canon };
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------
type Json = unknown;
const isObj = (v: Json): v is Record<string, Json> => typeof v === 'object' && v !== null && !Array.isArray(v);
const asArray = (v: Json): Json[] => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);
const str = (v: Json): string | undefined => (typeof v === 'string' && v.trim() ? clean(v) : typeof v === 'number' ? String(v) : undefined);

function isEventType(t: Json): boolean {
  return asArray(t).some((x) => typeof x === 'string' && (x === 'Event' || x.endsWith('Event') || x === 'Festival'));
}

function collectJsonLd(root: HTMLElement): Json[] {
  const out: Json[] = [];
  for (const s of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      out.push(JSON.parse(s.textContent.trim()));
    } catch {
      /* malformed block: skip */
    }
  }
  return out;
}

function findEvent(node: Json, depth = 0): Record<string, Json> | null {
  if (depth > 6) return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const f = findEvent(n, depth + 1);
      if (f) return f;
    }
    return null;
  }
  if (!isObj(node)) return null;
  if (isEventType(node['@type'])) return node;
  for (const key of ['@graph', 'mainEntity', 'itemListElement', 'item']) {
    const f = findEvent(node[key], depth + 1);
    if (f) return f;
  }
  return null;
}

function addressText(a: Json): string | undefined {
  if (typeof a === 'string') return clean(a);
  if (!isObj(a)) return undefined;
  const parts = [str(a.streetAddress), str(a.addressLocality), str(a.addressRegion)].filter(Boolean);
  return parts.length ? parts.join(', ') : undefined;
}

interface OfferInfo { min?: number; max?: number; currencyOk: boolean; soldOut: boolean; free: boolean }
function readOffers(offers: Json): OfferInfo {
  const prices: number[] = [];
  let currencyOk = true;
  let soldOut = false;
  let any = false;
  const visit = (o: Json) => {
    if (!isObj(o)) return;
    any = true;
    const cur = str(o.priceCurrency);
    if (cur && cur.toUpperCase() !== 'BRL') currencyOk = false;
    for (const k of ['lowPrice', 'highPrice', 'price']) {
      const p = parseBRL(typeof o[k] === 'number' ? (o[k] as number) : str(o[k]));
      if (p !== null) prices.push(p);
    }
    if (/SoldOut/i.test(str(o.availability) ?? '')) soldOut = true;
    for (const sub of asArray(o.offers)) visit(sub);
  };
  for (const o of asArray(offers)) visit(o);
  if (!any || !currencyOk || prices.length === 0) return { currencyOk, soldOut, free: false };
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return { min, max, currencyOk, soldOut, free: max === 0 };
}

export interface ParsedPage {
  via: 'json-ld' | 'opengraph';
  event?: Omit<RawEvent, 'source' | 'sourceId' | 'url' | 'fetchedAt'>;
  /** Why the page could not become an event. */
  problem?: string;
  partial: Record<string, unknown>;
}

export function parseEventPage(html: string): ParsedPage {
  const root = parse(html, { blockTextElements: { script: true, style: true } });
  const ld = findEvent(collectJsonLd(root));
  if (ld) return fromJsonLd(ld);
  return fromFallback(root);
}

function fromJsonLd(ld: Record<string, Json>): ParsedPage {
  const title = str(ld.name);
  const loc = asArray(ld.location).find(isObj) ?? (typeof ld.location === 'string' ? { name: ld.location } : undefined);
  const venueName = isObj(loc) ? str(loc.name) : undefined;
  const venueAddress = isObj(loc) ? addressText(loc.address) : undefined;
  const startsAt = toOffsetISO(str(ld.startDate));
  const endsAt = toOffsetISO(str(ld.endDate)) ?? undefined;
  const offer = readOffers(ld.offers);
  const statusText = str(ld.eventStatus) ?? '';
  const partial = { title, venueName, venueAddress, startDate: str(ld.startDate), endDate: str(ld.endDate), eventStatus: statusText };
  if (!title) return { via: 'json-ld', problem: 'JSON-LD Event without name', partial };
  if (!startsAt) return { via: 'json-ld', problem: 'startDate missing or without a time of day', partial };
  if (!venueName) return { via: 'json-ld', problem: 'location name missing', partial };
  if (/EventPostponed|EventRescheduled/i.test(statusText)) return { via: 'json-ld', problem: 'event postponed/rescheduled: confirm the new date', partial };
  if (!offer.currencyOk) return { via: 'json-ld', problem: 'price not in BRL', partial };

  let status: RawStatus = 'scheduled';
  if (/EventCancelled/i.test(statusText)) status = 'cancelled';
  else if (offer.soldOut) status = 'soldout';

  const performers = asArray(ld.performer).map((p) => (isObj(p) ? str(p.name) : str(p))).filter((x): x is string => !!x);
  const event: NonNullable<ParsedPage['event']> = { title, startsAt, venueName, status };
  if (endsAt) event.endsAt = endsAt;
  if (venueAddress) event.venueAddress = venueAddress;
  if (offer.min !== undefined) {
    event.priceMin = offer.min;
    event.priceMax = offer.max ?? offer.min;
    event.isFree = offer.free;
  }
  const description = str(ld.description);
  if (description) event.description = description;
  if (performers.length) event.lineup = performers;
  return { via: 'json-ld', event, partial };
}

function meta(root: HTMLElement, prop: string): string | undefined {
  const el = root.querySelector(`meta[property="${prop}"]`) ?? root.querySelector(`meta[name="${prop}"]`);
  return el?.getAttribute('content') ? clean(el.getAttribute('content')!) : undefined;
}

function fromFallback(root: HTMLElement): ParsedPage {
  const title = meta(root, 'og:title') ?? (root.querySelector('title')?.textContent ? clean(root.querySelector('title')!.textContent) : undefined);
  const description = meta(root, 'og:description') ?? meta(root, 'description');
  let startsAt: string | null = null;
  let endsAt: string | null = null;
  for (const t of root.querySelectorAll('time[datetime]')) {
    const iso = toOffsetISO(t.getAttribute('datetime'));
    if (!iso) continue;
    if (!startsAt) startsAt = iso;
    else if (!endsAt && Date.parse(iso) > Date.parse(startsAt)) endsAt = iso;
  }
  const locEl = root.querySelector('[itemprop="location"] [itemprop="name"]') ?? root.querySelector('[itemprop="location"]');
  const venueName = locEl ? clean(locEl.textContent) : undefined;
  const partial = { title, description, startsAt, venueName };
  if (!title) return { via: 'opengraph', problem: 'no title', partial };
  if (!startsAt) return { via: 'opengraph', problem: 'no <time datetime> with a time of day', partial };
  if (!venueName) return { via: 'opengraph', problem: 'venue not stated in a machine-readable way', partial };
  const event: NonNullable<ParsedPage['event']> = { title, startsAt, venueName, status: 'scheduled' };
  if (endsAt) event.endsAt = endsAt;
  if (description) event.description = description;
  if (looksFree(description)) event.isFree = true;
  return { via: 'opengraph', event, partial };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------
export interface LinkAdapterOptions {
  /** Where links.txt lives. */
  dataDir: string;
  cacheDir: string;
  offline?: boolean;
  fetchImpl?: PoliteOptions['fetchImpl'];
  sleep?: PoliteOptions['sleep'];
  minIntervalMs?: number;
}

export interface LinkAdapter extends SourceAdapter {
  report: AdapterReport;
  client: PoliteClient;
}

export function createLinkAdapter(opts: LinkAdapterOptions): LinkAdapter {
  const report = emptyReport();
  const client = new PoliteClient({
    userAgent: USER_AGENT,
    cacheDir: opts.cacheDir,
    ...(opts.offline !== undefined && { offline: opts.offline }),
    ...(opts.fetchImpl && { fetchImpl: opts.fetchImpl }),
    ...(opts.sleep && { sleep: opts.sleep }),
    ...(opts.minIntervalMs !== undefined && { minIntervalMs: opts.minIntervalMs }),
  });
  return {
    id: LINK_SOURCE,
    tier: 2,
    report,
    client,
    enabled: () => true,
    async fetch(ctx: FetchContext): Promise<RawEvent[]> {
      let text = '';
      try {
        text = await readFile(join(opts.dataDir, 'links.txt'), 'utf8');
      } catch {
        return [];
      }
      const events: RawEvent[] = [];
      for (const url of parseLinksFile(text)) {
        const res = await client.get(url);
        switch (res.kind) {
          case 'robots-disallowed':
            report.skipped.push({ ref: url, reason: 'robots.txt disallows this path' });
            ctx.log(`link: robots.txt disallows ${url}`);
            break;
          case 'blocked':
            report.skipped.push({ ref: url, reason: `host answered ${res.status}; stopped for this run` });
            break;
          case 'gone':
            report.gone.push(url);
            break;
          case 'error':
            report.skipped.push({ ref: url, reason: res.reason });
            break;
          case 'ok': {
            const parsed = parseEventPage(res.body);
            if (!parsed.event) {
              report.needsReview.push({ source: LINK_SOURCE, ref: url, reason: parsed.problem ?? 'unparsable', partial: parsed.partial });
              break;
            }
            events.push({ source: LINK_SOURCE, sourceId: linkSourceId(url), url, fetchedAt: ctx.now.toISOString(), ...parsed.event });
            report.stats[parsed.via] = (report.stats[parsed.via] ?? 0) + 1;
          }
        }
      }
      report.stats.links = parseLinksFile(text).length;
      return events;
    },
  };
}

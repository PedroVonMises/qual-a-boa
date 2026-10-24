// Approval, feed assembly (SeedDataset + generatedAt), diff summary and meta.json.
import type { Artist, EventItem, SeedDataset, Venue } from '../../app/src/domain/types.js';

import type { Candidate } from './normalize.js';
import { GENRES, genreId } from './ids.js';

export const SCHEMA_VERSION = 1;

export type Feed = SeedDataset;

export function canonicalGenres() {
  return GENRES.map(([slug, label]) => ({ id: genreId(slug), slug, label }));
}

/** Tier 1 auto-approves; tier 2/3 need `source:sourceId` in approved.json. */
export function isApproved(c: Candidate, approved: Set<string>): boolean {
  return c.tier === 1 || c.sources.some((s) => approved.has(`${s.source}:${s.sourceId}`));
}

export function parseApproved(json: unknown): Set<string> {
  const list = Array.isArray(json) ? json : (json as { approved?: unknown })?.approved;
  return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []);
}

export interface AssembleInput {
  generatedAt: string;
  previous: Feed | null;
  /** Final event list (carried + fresh, lifecycle already applied). */
  events: EventItem[];
  freshVenues: Venue[];
  freshArtists: Artist[];
  /** Keep previous venues/artists that are not referenced by any event (non-fresh mode). */
  carryForward: boolean;
}

const bySlug = <T extends { slug: string }>(a: T, b: T) => a.slug.localeCompare(b.slug);

export function assembleFeed(i: AssembleInput): Feed {
  const events = [...i.events].sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));
  const venues = new Map<string, Venue>();
  const artists = new Map<string, Artist>();
  if (i.carryForward && i.previous) {
    for (const v of i.previous.venues) venues.set(v.id, v);
    for (const a of i.previous.artists) artists.set(a.id, a);
  }
  const usedVenue = new Set(events.map((e) => e.venueId));
  const usedArtist = new Set(events.flatMap((e) => e.artistIds));
  for (const v of i.freshVenues) if (usedVenue.has(v.id)) venues.set(v.id, v);
  for (const a of i.freshArtists) if (usedArtist.has(a.id)) artists.set(a.id, a);
  const keepV = (v: Venue) => (i.carryForward ? true : usedVenue.has(v.id));
  const keepA = (a: Artist) => (i.carryForward ? true : usedArtist.has(a.id));
  return {
    generatedAt: i.generatedAt,
    genres: canonicalGenres(),
    venues: [...venues.values()].filter(keepV).sort(bySlug),
    artists: [...artists.values()].filter(keepA).sort(bySlug),
    events,
  };
}

// ---------------------------------------------------------------------------
// Diff
// ---------------------------------------------------------------------------
export interface FeedDiff {
  added: { id: string; title: string; startsAt: string }[];
  changed: { id: string; title: string; fields: string[] }[];
  cancelled: { id: string; title: string }[];
  removed: { id: string; title: string }[];
}

const DIFF_FIELDS: (keyof EventItem)[] = ['title', 'venueId', 'startsAt', 'endsAt', 'priceMin', 'priceMax', 'isFree', 'ageMin', 'ticketUrl', 'genreSlugs', 'artistIds'];

export function diffFeeds(prev: EventItem[], next: EventItem[]): FeedDiff {
  const p = new Map(prev.map((e) => [e.id, e]));
  const n = new Map(next.map((e) => [e.id, e]));
  const d: FeedDiff = { added: [], changed: [], cancelled: [], removed: [] };
  for (const e of next) {
    const old = p.get(e.id);
    if (!old) {
      d.added.push({ id: e.id, title: e.title, startsAt: e.startsAt });
      continue;
    }
    if (e.status === 'cancelled' && old.status !== 'cancelled') {
      d.cancelled.push({ id: e.id, title: e.title });
      continue;
    }
    const fields = DIFF_FIELDS.filter((f) => JSON.stringify(old[f]) !== JSON.stringify(e[f])) as string[];
    if (e.status !== old.status) fields.push('status');
    if (fields.length) d.changed.push({ id: e.id, title: e.title, fields });
  }
  for (const e of prev) if (!n.has(e.id)) d.removed.push({ id: e.id, title: e.title });
  return d;
}

export const prTitle = (date: string, d: FeedDiff) => `Ingest ${date}: ${d.added.length} new, ${d.changed.length} changed, ${d.cancelled.length} cancelled`;

export function diffSummary(date: string, d: FeedDiff, pending: Candidate[], needsReviewCount: number): string {
  const L: string[] = [`# ${prTitle(date, d)}`, ''];
  const sec = (title: string, rows: string[]) => {
    L.push(`## ${title} (${rows.length})`);
    L.push(...(rows.length ? rows.map((r) => `- ${r}`) : ['- none']), '');
  };
  sec('New', d.added.map((e) => `${e.title} (${e.startsAt})`));
  sec('Changed', d.changed.map((e) => `${e.title}: ${e.fields.join(', ')}`));
  sec('Cancelled', d.cancelled.map((e) => e.title));
  sec('Dropped (ended more than 24 h ago)', d.removed.map((e) => e.title));
  sec(
    'Waiting for approval (add "source:sourceId" to ingest/data/approved.json)',
    pending.map((c) => `\`${c.key}\` ${c.event.title} (${c.event.startsAt})${c.flags.length ? ` [${c.flags.join(', ')}]` : ''}`),
  );
  L.push(`Records needing review (could not be parsed): ${needsReviewCount}. See ingest/out/candidates.json.`, '');
  return L.join('\n');
}

export interface Meta {
  generatedAt: string;
  counts: { events: number; upcoming: number; cancelled: number; venues: number; artists: number };
  sources: Record<string, number>;
  schemaVersion: 1;
}

export function buildMeta(feed: Feed, sources: Record<string, number>, now: Date): Meta {
  return {
    generatedAt: feed.generatedAt,
    counts: {
      events: feed.events.length,
      upcoming: feed.events.filter((e) => e.status !== 'cancelled' && Date.parse(e.endsAt ?? e.startsAt) >= now.getTime()).length,
      cancelled: feed.events.filter((e) => e.status === 'cancelled').length,
      venues: feed.venues.length,
      artists: feed.artists.length,
    },
    sources,
    schemaVersion: SCHEMA_VERSION,
  };
}

/** Structural validation against the app's SeedDataset shape (used by the pipeline before writing and by tests). */
export function validateFeed(f: unknown): string[] {
  const errs: string[] = [];
  const o = f as Partial<Feed> | null;
  if (!o || typeof o !== 'object') return ['feed is not an object'];
  const isStr = (v: unknown) => typeof v === 'string' && v.length > 0;
  const iso = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(v) && !Number.isNaN(Date.parse(v));
  if (!iso(o.generatedAt)) errs.push('generatedAt must be a UTC ISO string');
  for (const k of ['genres', 'venues', 'artists', 'events'] as const) if (!Array.isArray(o[k])) errs.push(`${k} must be an array`);
  if (errs.length) return errs;
  const genreSlugs = new Set(o.genres!.map((g) => g.slug));
  const venueIds = new Set<string>();
  for (const v of o.venues!) {
    if (!isStr(v.id) || !isStr(v.slug) || !isStr(v.name) || !isStr(v.area) || !isStr(v.city)) errs.push(`venue ${v.slug}: missing string fields`);
    if (typeof v.lat !== 'number' || typeof v.lng !== 'number') errs.push(`venue ${v.slug}: lat/lng`);
    if (!['open', 'closed', 'unverified'].includes(v.status)) errs.push(`venue ${v.slug}: status`);
    if (typeof v.adultOnly !== 'boolean' || typeof v.placeholder !== 'boolean') errs.push(`venue ${v.slug}: booleans`);
    if (!Array.isArray(v.genreSlugs) || v.genreSlugs.some((g) => !genreSlugs.has(g))) errs.push(`venue ${v.slug}: genreSlugs`);
    if (!isStr(v.coverKey)) errs.push(`venue ${v.slug}: coverKey`);
    venueIds.add(v.id);
  }
  const artistIds = new Set(o.artists!.map((a) => a.id));
  const ids = new Set<string>();
  for (const e of o.events!) {
    const tag = `event ${e.id}`;
    if (!isStr(e.id) || ids.has(e.id)) errs.push(`${tag}: id missing or duplicated`);
    ids.add(e.id);
    if (!isStr(e.title)) errs.push(`${tag}: title`);
    if (!venueIds.has(e.venueId)) errs.push(`${tag}: unknown venue`);
    if (!iso(e.startsAt)) errs.push(`${tag}: startsAt`);
    if (e.endsAt !== undefined && (!iso(e.endsAt) || Date.parse(e.endsAt) <= Date.parse(e.startsAt))) errs.push(`${tag}: endsAt`);
    for (const k of ['priceMin', 'priceMax'] as const) if (e[k] !== null && (typeof e[k] !== 'number' || e[k]! < 0)) errs.push(`${tag}: ${k}`);
    if (typeof e.isFree !== 'boolean') errs.push(`${tag}: isFree`);
    if (typeof e.ageMin !== 'number') errs.push(`${tag}: ageMin`);
    if (!Array.isArray(e.genreSlugs) || e.genreSlugs.some((g) => !genreSlugs.has(g))) errs.push(`${tag}: genreSlugs`);
    if (!Array.isArray(e.artistIds) || e.artistIds.some((a) => !artistIds.has(a))) errs.push(`${tag}: artistIds`);
    if (!['published', 'cancelled', 'draft'].includes(e.status)) errs.push(`${tag}: status`);
    if (!isStr(e.coverKey)) errs.push(`${tag}: coverKey`);
    if (e.ticketUrl !== undefined && !/^https:\/\//.test(e.ticketUrl)) errs.push(`${tag}: ticketUrl must be https`);
    if (e.imageUrl !== undefined && !/^https:\/\//.test(e.imageUrl)) errs.push(`${tag}: imageUrl must be https`);
    if (typeof e.popularity !== 'number' || e.popularity < 0 || e.popularity > 100) errs.push(`${tag}: popularity`);
  }
  return errs;
}

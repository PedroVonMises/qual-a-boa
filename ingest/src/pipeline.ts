// Orchestration: adapters -> normalize -> dedupe -> lifecycle -> approval -> feed/meta/candidates files.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { Artist, EventItem, Venue } from '../../app/src/domain/types.js';

import { buildAdapters, type ReportingAdapter } from './adapters/index.js';
import { emptyReport, type NeedsReview } from './adapters/report.js';
import { applyLifecycle, dedupeBySourceId, mergeCrossSource } from './dedupe.js';
import { createNominatimGeocoder } from './geocode.js';
import type { FetchFn } from './http.js';
import { eventId } from './ids.js';
import { normalizeEvent, VenueIndex, type Candidate, type GenreKeywords, type VenueEntry } from './normalize.js';
import { linkSourceId } from './adapters/link.js';
import { resolvePaths, type Paths } from './config.js';
import { assembleFeed, buildMeta, diffFeeds, diffSummary, isApproved, parseApproved, prTitle, validateFeed, type Feed, type FeedDiff, type Meta } from './publish.js';
import { USER_AGENT, type RawEvent } from './types.js';

export interface RunOptions {
  paths?: Partial<Pick<Paths, 'dataDir' | 'outDir' | 'feedDir' | 'cacheDir'>>;
  now?: Date;
  /** Cache-only network mode (fixtures). */
  offline?: boolean;
  /** Do not carry the previous feed's events/venues/artists forward (cutover to real data). */
  fresh?: boolean;
  geocode?: boolean;
  /** Write files (default true). */
  write?: boolean;
  /** Replace the adapter list (tests). */
  adapters?: ReportingAdapter[];
  fetchImpl?: FetchFn;
  sleep?: (ms: number) => Promise<void>;
  loadOptionalAdapters?: boolean;
  log?: (m: string) => void;
}

export interface RunResult {
  feed: Feed;
  meta: Meta;
  diff: FeedDiff;
  candidates: Candidate[];
  pending: Candidate[];
  needsReview: NeedsReview[];
  skipped: { ref: string; reason: string }[];
  prTitle: string;
  summary: string;
  problems: string[];
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

/** Reads a data file from the data dir, falling back to the package defaults. */
async function readData<T>(p: Paths, name: string, fallback: T): Promise<T> {
  return (await readJson<T>(join(p.dataDir, name))) ?? (await readJson<T>(join(p.defaultDataDir, name))) ?? fallback;
}

export async function runPipeline(opts: RunOptions = {}): Promise<RunResult> {
  const paths = resolvePaths(opts.paths);
  const now = opts.now ?? new Date();
  const log = opts.log ?? (() => {});
  const offline = opts.offline ?? false;

  const venueEntries = await readData<VenueEntry[]>(paths, 'venues.json', []);
  const keywords = await readData<GenreKeywords>(paths, 'genre-keywords.json', {});
  const approved = parseApproved(await readJson<unknown>(join(paths.dataDir, 'approved.json')));
  const previous = await readJson<Feed>(join(paths.feedDir, 'events.json'));

  const adapters =
    opts.adapters ??
    (await buildAdapters({
      dataDir: paths.dataDir,
      cacheDir: paths.cacheDir,
      offline,
      ...(opts.fetchImpl && { fetchImpl: opts.fetchImpl }),
      ...(opts.sleep && { sleep: opts.sleep }),
      loadOptional: opts.loadOptionalAdapters ?? true,
      log,
    }));

  const tierOf = new Map(adapters.map((a) => [a.id, a.tier]));
  const tier = (source: string): 1 | 2 | 3 => tierOf.get(source) ?? tierOf.get(source.split(':')[0]!) ?? 3;

  // 1. fetch
  const raws: RawEvent[] = [];
  const needsReview: NeedsReview[] = [];
  const skipped: { ref: string; reason: string }[] = [];
  const goneIds = new Set<string>();
  const sourceCounts: Record<string, number> = {};
  const ctx = { now, userAgent: USER_AGENT, dataDir: paths.dataDir, log };
  for (const a of adapters) {
    if (!a.enabled()) {
      log(`adapter ${a.id}: disabled`);
      continue;
    }
    try {
      const got = await a.fetch(ctx);
      raws.push(...got);
      const rep = a.report ?? emptyReport();
      needsReview.push(...rep.needsReview);
      skipped.push(...rep.skipped);
      // `gone` urls map to event ids only for the link adapter (its sourceId is the url hash).
      if (a.id === 'link') for (const url of rep.gone) goneIds.add(eventId(`${a.id}:${linkSourceId(url)}`));
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      skipped.push({ ref: `adapter:${a.id}`, reason });
      log(`adapter ${a.id} failed: ${reason}`);
    }
  }

  // 2. normalize
  const geocode = opts.geocode ? createNominatimGeocoder({ cacheDir: paths.cacheDir, ...(opts.fetchImpl && { fetchImpl: opts.fetchImpl }), ...(opts.sleep && { sleep: opts.sleep }), log }) : undefined;
  const venues = new VenueIndex(venueEntries);
  const normalized: Candidate[] = [];
  for (const raw of raws) {
    const r = await normalizeEvent(raw, { venues, keywords, tier, ...(geocode && { geocode }) });
    if (r.ok) normalized.push(r.candidate);
    else needsReview.push({ source: raw.source, ref: raw.url || raw.sourceId, reason: r.reason, partial: { title: raw.title } });
  }

  // 3. dedupe + merge
  const candidates = mergeCrossSource(dedupeBySourceId(normalized));

  // 4. approval. Cancellations of already published events apply without waiting for approval.
  const prevIds = new Set((previous?.events ?? []).map((e) => e.id));
  const publishable: Candidate[] = [];
  const pending: Candidate[] = [];
  for (const c of candidates) {
    if (isApproved(c, approved) || (c.event.status === 'cancelled' && prevIds.has(c.event.id))) publishable.push(c);
    else pending.push(c);
  }
  for (const c of publishable) {
    for (const s of c.sources) sourceCounts[s.source] = (sourceCounts[s.source] ?? 0) + 1;
  }

  // 5. lifecycle + assemble
  const carry = !(opts.fresh ?? false);
  const prevEvents: EventItem[] = previous?.events ?? [];
  const life = applyLifecycle(
    publishable.map((c) => c.event),
    { now, previous: prevEvents, goneIds },
    carry,
  );
  const freshVenues: Venue[] = publishable.map((c) => c.venue);
  const freshArtists: Artist[] = publishable.flatMap((c) => c.artists);
  const feed = assembleFeed({ generatedAt: now.toISOString(), previous, events: life.events, freshVenues, freshArtists, carryForward: carry });
  const carried = feed.events.length - publishable.filter((c) => feed.events.some((e) => e.id === c.event.id)).length;
  if (carried > 0) sourceCounts.carried = carried;

  // No content change: keep the previous generatedAt and files, so a quiet day produces no PR.
  const sameContent = !!previous && JSON.stringify({ ...feed, generatedAt: '' }) === JSON.stringify({ ...previous, generatedAt: '' });
  if (sameContent && previous) feed.generatedAt = previous.generatedAt;
  const problems = validateFeed(feed);
  const diff = diffFeeds(prevEvents, feed.events);
  const meta = buildMeta(feed, sourceCounts, now);
  const date = now.toISOString().slice(0, 10);
  const title = prTitle(date, diff);
  const summary = diffSummary(date, diff, pending, needsReview.length);

  if (opts.write ?? true) {
    if (problems.length) throw new Error(`refusing to write an invalid feed:\n${problems.slice(0, 10).join('\n')}`);
    await mkdir(paths.outDir, { recursive: true });
    await mkdir(paths.feedDir, { recursive: true });
    const candidatesDoc = {
      generatedAt: feed.generatedAt,
      counts: { candidates: candidates.length, published: publishable.length, pendingApproval: pending.length, needsReview: needsReview.length, skipped: skipped.length },
      pendingApproval: pending.map(describe),
      published: publishable.map(describe),
      needsReview,
      skipped,
      gone: [...goneIds],
      diff,
    };
    await writeFile(join(paths.outDir, 'candidates.json'), JSON.stringify(candidatesDoc, null, 2) + '\n');
    await writeFile(join(paths.outDir, 'summary.md'), summary);
    await writeFile(join(paths.outDir, 'pr-title.txt'), title + '\n');
    await writeFile(join(paths.feedDir, 'events.json'), JSON.stringify(feed, null, 2) + '\n');
    await writeFile(join(paths.feedDir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
  }
  return { feed, meta, diff, candidates, pending, needsReview, skipped, prTitle: title, summary, problems };
}

function describe(c: Candidate) {
  return {
    key: c.key,
    tier: c.tier,
    sources: c.sources,
    flags: c.flags,
    event: c.event,
    venue: { id: c.venue.id, name: c.venue.name, matched: c.venueMatched, status: c.venue.status },
    artists: c.artists.map((a) => a.name),
  };
}

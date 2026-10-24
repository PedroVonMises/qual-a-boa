// On-device recommender. Pure and deterministic: same inputs always give the same order.
// Contracts live in recommendTypes.ts. The SQL/seed repos never see this: `recommended` is client-only.
import { formatDistance, spParts } from './format';
import { IN_PROGRESS_WINDOW_MS } from './filters';
import type { Reason, RecoContext, Scored } from './recommendTypes';
import type { SearchItem } from './types';

/** All tunable numbers in one place. The first block sums to 1. */
export const WEIGHTS = {
  proximity: 0.24,
  timeFit: 0.26,
  popularity: 0.12,
  taste: 0.18,
  artistMatch: 0.08,
  venueAffinity: 0.06,
  priceFit: 0.06,
} as const;

export const TUNING = {
  /** Distance decay: exp(-d / (radiusKm * PROXIMITY_SPREAD)). At the radius edge the feature is about 0.135. */
  PROXIMITY_SPREAD: 0.5,
  /** In progress or starting within this window scores the maximum. */
  SOON_MS: 3 * 3600_000,
  /** Time-fit e-folding scale after the soon window. */
  TIME_DECAY_H: 48,
  /** Plateau value right after the soon window. */
  TIME_AFTER_SOON: 0.9,
  /** Score subtracted for venues not verified with us. */
  UNVERIFIED_PENALTY: 0.08,
  /** priceFit of a free event. */
  FREE_PRICE_FIT: 0.6,
  /** Signals needed for full confidence in personal terms. */
  CONFIDENCE_SIGNALS: 5,
  /** Max items in a row from one venue. */
  MAX_SAME_VENUE_RUN: 2,
  /** A "Em alta" tag from this popularity up. */
  HOT_FROM: 80,
  /** Max reason tags per card. */
  MAX_REASONS: 3,
} as const;

/** RecoContext plus optional genre labels (slug to pt-BR label) for the "Você curte X" tag. */
export interface LabeledContext extends RecoContext {
  genreLabels?: Record<string, string>;
}

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

export const confidenceOf = (signals: number) => clamp01(signals / TUNING.CONFIDENCE_SIGNALS);

export function proximityFeature(distanceKm: number, radiusKm: number): number {
  const scale = Math.max(0.1, radiusKm) * TUNING.PROXIMITY_SPREAD;
  return Math.exp(-Math.max(0, distanceKm) / scale);
}

/** 1 while on or about to start, then decays over days; 0 once ended. */
export function timeFeature(startsAt: string, endsAt: string | undefined, nowMs: number): number {
  const start = Date.parse(startsAt);
  const end = endsAt ? Date.parse(endsAt) : start + IN_PROGRESS_WINDOW_MS;
  if (nowMs > end) return 0;
  const delta = start - nowMs;
  if (delta <= TUNING.SOON_MS) return 1;
  const hours = (delta - TUNING.SOON_MS) / 3600_000;
  return TUNING.TIME_AFTER_SOON * Math.exp(-hours / TUNING.TIME_DECAY_H);
}

/** Highest weight among the event's genres (falls back to the venue's genres). */
function tasteFeature(item: SearchItem, ctx: RecoContext): { value: number; slug?: string } {
  const slugs = item.event.genreSlugs.length ? item.event.genreSlugs : item.venue.genreSlugs;
  let best = 0;
  let bestSlug: string | undefined;
  for (const s of slugs) {
    const w = ctx.profile.genreWeights[s] ?? 0;
    if (w > best || (w === best && w > 0 && bestSlug !== undefined && s < bestSlug)) {
      best = w;
      bestSlug = s;
    }
  }
  return { value: clamp01(best), slug: bestSlug };
}

function priceFeature(item: SearchItem, median: number | null): number {
  if (item.event.isFree) return TUNING.FREE_PRICE_FIT;
  const p = item.event.priceMin;
  if (p == null || median == null) return 0;
  return Math.exp(-Math.abs(p - median) / Math.max(median, 20));
}

const hourLabel = (ms: number) => {
  const p = spParts(ms);
  return p.minute === 0 ? `${p.hour}h` : `${p.hour}h${String(p.minute).padStart(2, '0')}`;
};

/** Nights run past midnight: before 06h still belongs to the previous day. */
const nightDay = (ms: number) => {
  const p = spParts(ms);
  return p.hour < 6 ? p.dayNumber - 1 : p.dayNumber;
};

function genreLabel(slug: string, ctx: LabeledContext): string {
  const l = ctx.genreLabels?.[slug];
  if (l) return l;
  const t = slug.replace(/-/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function scoreItem(item: SearchItem, ctx: LabeledContext, nowMs: number): { score: number; reasons: Reason[] } {
  const { event, venue, distanceKm } = item;
  const conf = confidenceOf(ctx.profile.signals);

  const prox = proximityFeature(distanceKm, ctx.radiusKm);
  const time = timeFeature(event.startsAt, event.endsAt, nowMs);
  const pop = clamp01(event.popularity / 100);
  const taste = tasteFeature(item, ctx);
  const artistSet = new Set([...ctx.profile.artistSlugs, ...(ctx.profile.artistIds ?? [])]);
  const artist = event.artistIds.some((id) => artistSet.has(id)) ? 1 : 0;
  const venueSet = new Set([...ctx.profile.venueSlugs, ...(ctx.profile.venueIds ?? [])]);
  const venueAff = venueSet.has(venue.slug) || venueSet.has(venue.id) ? 1 : 0;
  const price = priceFeature(item, ctx.profile.priceMedian);

  let score =
    WEIGHTS.proximity * prox +
    WEIGHTS.timeFit * time +
    WEIGHTS.popularity * pop +
    conf * (WEIGHTS.taste * taste.value + WEIGHTS.artistMatch * artist + WEIGHTS.venueAffinity * venueAff + WEIGHTS.priceFit * price);
  if (venue.status === 'unverified') score -= TUNING.UNVERIFIED_PENALTY;

  const reasons: Reason[] = [];
  if (conf > 0 && artist) reasons.push({ kind: 'artist', text: 'Artista que você curte' });
  if (conf > 0 && taste.slug && taste.value >= 0.4) reasons.push({ kind: 'taste', text: `Você curte ${genreLabel(taste.slug, ctx)}` });
  if (conf > 0 && venueAff) reasons.push({ kind: 'venue', text: 'Casa que você curte' });
  if (time > 0) {
    const start = Date.parse(event.startsAt);
    if (start <= nowMs) reasons.push({ kind: 'time', text: 'Acontecendo agora' });
    else if (nightDay(start) === nightDay(nowMs)) reasons.push({ kind: 'time', text: `Hoje · ${hourLabel(start)}` });
  }
  if (prox >= 0.5) reasons.push({ kind: 'near', text: `Perto de você · ${formatDistance(distanceKm)}` });
  if (event.popularity >= TUNING.HOT_FROM) reasons.push({ kind: 'hot', text: 'Em alta' });
  if (event.isFree) reasons.push({ kind: 'price', text: 'Entrada grátis' });
  else if (conf > 0 && price >= 0.8) reasons.push({ kind: 'price', text: 'No seu orçamento' });

  return { score: round6(clamp01(score)), reasons: reasons.slice(0, TUNING.MAX_REASONS) };
}

/** score desc, startsAt asc, id asc. */
function compare(a: Scored, b: Scored): number {
  if (a.score !== b.score) return b.score - a.score;
  const sa = Date.parse(a.item.event.startsAt);
  const sb = Date.parse(b.item.event.startsAt);
  if (sa !== sb) return sa - sb;
  return a.item.event.id < b.item.event.id ? -1 : a.item.event.id > b.item.event.id ? 1 : 0;
}

/** Greedy re-rank: takes the best remaining item that does not make a run longer than the cap at one venue. */
function diversify(sorted: Scored[]): Scored[] {
  const rest = sorted.slice();
  const out: Scored[] = [];
  while (rest.length) {
    let pick = 0;
    const n = out.length;
    if (n >= TUNING.MAX_SAME_VENUE_RUN) {
      const run = out.slice(n - TUNING.MAX_SAME_VENUE_RUN).map((s) => s.item.venue.id);
      if (run.every((v) => v === run[0])) {
        const idx = rest.findIndex((s) => s.item.venue.id !== run[0]);
        if (idx > 0) pick = idx;
      }
    }
    out.push(rest.splice(pick, 1)[0]);
  }
  return out;
}

export function rankItems(items: SearchItem[], ctx: LabeledContext, nowMs: number): Scored[] {
  const scored: Scored[] = items.map((item) => ({ item, ...scoreItem(item, ctx, nowMs) }));
  scored.sort(compare);
  return diversify(scored);
}

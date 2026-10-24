import { useQueries } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { getRepo } from '@/data';
import { queryKeys } from '@/data/queries';
import { formatBRL } from '@/domain/format';
import { EMPTY_PROFILE, type TasteProfile } from '@/domain/recommendTypes';
import type { Artist, EventDetail, VenueDetail } from '@/domain/types';
import { useCheckins } from '@/state/checkins';
import { useFavorites } from '@/state/favorites';
import { useFilters } from '@/state/filters';
import { useFollows } from '@/state/follows';
import { useReviews } from '@/state/reviews';
import { minuteNow } from './clock';
import { decayed, useTaste, type GenreSignal, type ViewKind, type ViewSignal } from '@/state/taste';

export const PROFILE_CAP = 30;
export const PROFILE_STALE_MS = 5 * 60_000;
export const MIN_GOOD_RATING = 4;

/** Relative weights of each kind of signal. */
const W = { favorite: 1, follow: 1, checkin: 1.5, review: 1.5, view: 0.5, lineup: 0.5, venueGenre: 0.5, artistGenre: 0.6 };
const IMPLICIT_SIGNAL_CAP = 3;

export interface ProfileInput {
  events: { detail: EventDetail; weight: number; priced: boolean }[];
  venues: { detail: VenueDetail; weight: number }[];
  artists: { artist: Artist; weight: number }[];
  /** Venue slugs known without resolving (favorites, venue views). */
  venueSlugs: string[];
  artistSlugs: string[];
  /** Already-decayed implicit genre weights. */
  implicitGenres: Record<string, number>;
  /** Count of explicit signals (favorites, follows, check-ins, good reviews). */
  explicitSignals: number;
  implicitSignals: number;
}

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Pure: turns resolved entities into a TasteProfile. */
export function buildProfile(input: ProfileInput): TasteProfile {
  const raw: Record<string, number> = {};
  const add = (slug: string, w: number) => {
    raw[slug] = (raw[slug] ?? 0) + w;
  };
  const venueSlugs = new Set(input.venueSlugs);
  const venueIds = new Set<string>();
  const artistSlugs = new Set(input.artistSlugs);
  const artistIds = new Set<string>();
  const prices: number[] = [];

  for (const { detail, weight, priced } of input.events) {
    for (const g of detail.event.genreSlugs) add(g, weight);
    if (priced && !detail.event.isFree && detail.event.priceMin != null) prices.push(detail.event.priceMin);
    if (weight >= W.checkin) {
      venueSlugs.add(detail.venue.slug);
      venueIds.add(detail.venue.id);
    }
    for (const a of detail.lineup) {
      for (const g of a.genreSlugs) add(g, W.lineup * weight * W.artistGenre);
      if (priced) {
        artistSlugs.add(a.slug);
        artistIds.add(a.id);
      }
    }
  }
  for (const { detail, weight } of input.venues) {
    venueSlugs.add(detail.venue.slug);
    venueIds.add(detail.venue.id);
    for (const g of detail.venue.genreSlugs) add(g, weight * W.venueGenre);
  }
  for (const { artist, weight } of input.artists) {
    artistSlugs.add(artist.slug);
    artistIds.add(artist.id);
    for (const g of artist.genreSlugs) add(g, weight * W.artistGenre);
  }
  for (const [g, w] of Object.entries(input.implicitGenres)) add(g, w);

  const max = Math.max(0, ...Object.values(raw));
  const genreWeights: Record<string, number> = {};
  if (max > 0) for (const [g, w] of Object.entries(raw)) genreWeights[g] = Math.round((w / max) * 1000) / 1000;

  return {
    genreWeights,
    artistSlugs: [...artistSlugs].sort(),
    artistIds: [...artistIds].sort(),
    venueSlugs: [...venueSlugs].sort(),
    venueIds: [...venueIds].sort(),
    priceMedian: median(prices),
    signals: input.explicitSignals + Math.min(IMPLICIT_SIGNAL_CAP, input.implicitSignals),
  };
}

const lastN = <T,>(xs: T[]): T[] => xs.slice(-PROFILE_CAP);

/**
 * Builds the user's TasteProfile from favorites, follows, check-ins, own reviews (rating >= 4) and the implicit taste
 * store. Ids are resolved through the same query keys as data/queries.ts (shared cache), capped to the 30 most recent.
 */
export function useTasteProfile(): TasteProfile {
  const favEvents = useFavorites((s) => s.eventIds);
  const favVenues = useFavorites((s) => s.venueIds);
  const favArtists = useFavorites((s) => s.artistSlugs);
  const follows = useFollows((s) => s.follows);
  const checkins = useCheckins((s) => s.checkins);
  const mine = useReviews((s) => s.mine);
  const genres = useTaste((s) => s.genres);
  const views = useTaste((s) => s.views);

  const plan = useMemo(() => {
    const eventW = new Map<string, number>();
    const bump = (m: Map<string, number>, id: string, w: number) => m.set(id, (m.get(id) ?? 0) + w);
    const followed = Object.keys(follows);
    lastN(favEvents).forEach((id) => bump(eventW, id, W.favorite));
    lastN(followed).forEach((id) => bump(eventW, id, W.follow));
    lastN(checkins.map((c) => c.eventId)).forEach((id) => bump(eventW, id, W.checkin));
    const goodReviews = mine.filter((r) => r.rating >= MIN_GOOD_RATING).map((r) => r.eventId);
    lastN(goodReviews).forEach((id) => bump(eventW, id, W.review));
    const priced = new Set([...favEvents, ...followed]);
    const viewOf = (kind: ViewSignal['kind']) => views.filter((v) => v.kind === kind).slice(0, PROFILE_CAP);
    viewOf('event').forEach((v) => bump(eventW, v.id, W.view));
    const eventIds = [...eventW.keys()].slice(-PROFILE_CAP * 2).sort((a, b) => (eventW.get(b) ?? 0) - (eventW.get(a) ?? 0)).slice(0, PROFILE_CAP);

    const venueW = new Map<string, number>();
    lastN(favVenues).forEach((s) => bump(venueW, s, W.favorite));
    viewOf('venue').forEach((v) => bump(venueW, v.id, W.view));
    const artistW = new Map<string, number>();
    lastN(favArtists).forEach((s) => bump(artistW, s, W.favorite));
    viewOf('artist').forEach((v) => bump(artistW, v.id, W.view));

    const explicit = new Set<string>([
      ...favEvents.map((i) => `e:${i}`),
      ...favVenues.map((i) => `v:${i}`),
      ...favArtists.map((i) => `a:${i}`),
      ...followed.map((i) => `f:${i}`),
      ...checkins.map((c) => `c:${c.eventId}`),
      ...goodReviews.map((i) => `r:${i}`),
    ]);
    return {
      eventIds,
      eventW,
      priced,
      venueSlugs: [...venueW.keys()].slice(0, PROFILE_CAP),
      venueW,
      artistSlugs: [...artistW.keys()].slice(0, PROFILE_CAP),
      artistW,
      explicit: explicit.size,
      implicit: Object.keys(genres).length + views.length,
    };
  }, [favEvents, favVenues, favArtists, follows, checkins, mine, genres, views]);

  const events = useQueries({
    queries: plan.eventIds.map((id) => ({
      queryKey: queryKeys.event(id),
      queryFn: () => getRepo().getEvent(id),
      staleTime: PROFILE_STALE_MS,
    })),
    combine: (rs) => rs.map((r) => r.data),
  });
  const venues = useQueries({
    queries: plan.venueSlugs.map((slug) => ({
      queryKey: queryKeys.venue(slug),
      queryFn: () => getRepo().getVenue(slug),
      staleTime: PROFILE_STALE_MS,
    })),
    combine: (rs) => rs.map((r) => r.data),
  });
  const artists = useQueries({
    queries: plan.artistSlugs.map((slug) => ({
      queryKey: queryKeys.artist(slug),
      queryFn: () => getRepo().getArtist(slug),
      staleTime: PROFILE_STALE_MS,
    })),
    combine: (rs) => rs.map((r) => r.data),
  });

  return useMemo(() => {
    const now = minuteNow();
    const implicitGenres: Record<string, number> = {};
    for (const [slug, g] of Object.entries(genres as Record<string, GenreSignal>)) implicitGenres[slug] = decayed(g.w, g.at, now);
    const hasAny = plan.explicit + plan.implicit > 0;
    if (!hasAny) return EMPTY_PROFILE;
    return buildProfile({
      events: events.flatMap((d, i) => (d ? [{ detail: d, weight: plan.eventW.get(plan.eventIds[i]) ?? 0, priced: plan.priced.has(plan.eventIds[i]) }] : [])),
      venues: venues.flatMap((d, i) => (d ? [{ detail: d, weight: plan.venueW.get(plan.venueSlugs[i]) ?? 0 }] : [])),
      artists: artists.flatMap((d, i) => (d ? [{ artist: d.artist, weight: plan.artistW.get(plan.artistSlugs[i]) ?? 0 }] : [])),
      venueSlugs: plan.venueSlugs,
      artistSlugs: plan.artistSlugs,
      implicitGenres,
      explicitSignals: plan.explicit,
      implicitSignals: plan.implicit,
    });
  }, [plan, events, venues, artists, genres]);
}

/** Records every newly selected genre filter as an implicit taste signal (skips the initial selection). */
export function useRecordGenreFilters(): void {
  const selected = useFilters((s) => s.filters.genreSlugs);
  const record = useTaste((s) => s.recordGenreFilter);
  const prev = useRef<string[] | null>(null);
  useEffect(() => {
    if (prev.current) for (const slug of selected) if (!prev.current.includes(slug)) record(slug);
    prev.current = selected;
  }, [selected, record]);
}

/** Perfil "Zerar recomendações": clears the implicit taste store only (favorites, follows, reviews stay). */
export function useResetRecommendations(): () => void {
  const reset = useTaste((s) => s.reset);
  return useCallback(() => reset(), [reset]);
}

/** Perfil "Por que estou vendo isso?": short pt-BR lines describing what the profile is built from. */
export function explainProfile(profile: TasteProfile, genreLabels: Record<string, string> = {}): string[] {
  const lines: string[] = [];
  if (profile.signals === 0) {
    lines.push('Ainda não conhecemos o seu gosto. Mostramos o que está em alta perto de você e quando começa.');
  } else {
    const top = Object.entries(profile.genreWeights)
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
      .slice(0, 3)
      .map(([slug]) => genreLabels[slug] ?? slug.replace(/-/g, ' '));
    if (top.length) lines.push(`Estilos que você curte: ${top.join(', ')}.`);
    if (profile.artistSlugs.length) {
      const n = profile.artistSlugs.length;
      lines.push(`${n} ${n === 1 ? 'artista' : 'artistas'} que você segue ou salvou.`);
    }
    if (profile.venueSlugs.length) {
      const n = profile.venueSlugs.length;
      lines.push(`${n} ${n === 1 ? 'casa' : 'casas'} que você curte, visitou ou avaliou bem.`);
    }
    if (profile.priceMedian != null) lines.push(`Preço típico dos seus eventos: ${formatBRL(profile.priceMedian)}.`);
    if (profile.signals < 5) lines.push('Poucos sinais ainda: a ordem mistura o seu gosto com o que está em alta perto de você.');
  }
  lines.push('A ordem também considera distância, horário e popularidade. Tudo é calculado neste aparelho.');
  return lines;
}

/** Records one implicit "viewed" taste signal per screen visit. Pass undefined until the entity has loaded. */
export function useRecordView(kind: ViewKind, id: string | undefined): void {
  const record = useTaste((s) => s.recordView);
  useEffect(() => {
    if (id) record(kind, id);
  }, [kind, id, record]);
}

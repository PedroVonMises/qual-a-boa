import { useCallback, useMemo, useState } from 'react';

import { useGenres, useSearchEvents } from '@/data/queries';
import { toSearchParams, type FilterState } from '@/domain/filters';
import { rankItems, type LabeledContext } from '@/domain/recommend';
import type { Scored } from '@/domain/recommendTypes';
import type { SearchItem, SearchParams } from '@/domain/types';
import { useFilters } from '@/state/filters';
import { useLocation } from '@/state/location';
import { minuteNow } from './clock';
import { useTasteProfile } from './useTasteProfile';

/** Items shown per client-side page of the recommended ranking. */
export const RECOMMENDED_PAGE = 20;

/** Search params for the given filters, anchored on the stored location. */
export function useSearchParams(filters: FilterState, limit?: number): Omit<SearchParams, 'cursor'> {
  const location = useLocation((s) => s.location);
  const now = minuteNow();
  return useMemo(() => {
    const p = toSearchParams(filters, location, now);
    // `recommended` fetches its own candidate pool (toSearchParams sets the limit); a caller limit only applies to repo sorts.
    return limit && filters.sort !== 'recommended' ? { ...p, limit } : p;
  }, [filters, location, limit, now]);
}

/** Ranking context (profile + radius + genre labels) shared by the Explorar and Mapa screens. */
export function useRecoContext(radiusKm: number): LabeledContext {
  const profile = useTasteProfile();
  const genres = useGenres().data;
  return useMemo(() => {
    const genreLabels: Record<string, string> = {};
    for (const g of genres ?? []) genreLabels[g.slug] = g.label;
    return { profile, radiusKm, genreLabels };
  }, [profile, radiusKm, genres]);
}

interface Paged {
  items: SearchItem[];
  scored: Scored[];
  total: number | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
}

/** Ranks candidates on device and pages them client-side. Does nothing while `active` is false. */
function useRankedPages(candidates: SearchItem[], radiusKm: number, pageSize: number, active: boolean, resetKey: string) {
  const ctx = useRecoContext(radiusKm);
  const now = minuteNow();
  const ranked = useMemo(() => (active ? rankItems(candidates, ctx, now) : []), [active, candidates, ctx, now]);
  // Paging resets whenever the query changes: the count is only valid for the key it was set under.
  const [paging, setPaging] = useState({ key: resetKey, count: pageSize });
  const visible = paging.key === resetKey ? paging.count : pageSize;
  const scored = useMemo(() => ranked.slice(0, visible), [ranked, visible]);
  const fetchNextPage = useCallback(async () => setPaging({ key: resetKey, count: visible + pageSize }), [resetKey, visible, pageSize]);
  return { ranked, scored, hasNextPage: visible < ranked.length, fetchNextPage };
}

/**
 * Candidates (popularity, ~80) from the repos, ranked on device, paged client-side.
 * `pageSize` is how many items are exposed per page.
 */
export function useRecommendedSearch(pageSize: number = RECOMMENDED_PAGE, filtersOverride?: FilterState): Paged {
  const storeFilters = useFilters((s) => s.filters);
  const base = filtersOverride ?? storeFilters;
  const filters = useMemo(() => ({ ...base, sort: 'recommended' as const }), [base]);
  const params = useSearchParams(filters);
  const q = useSearchEvents(params);
  const candidates = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);
  const r = useRankedPages(candidates, filters.radiusKm, pageSize, true, JSON.stringify(params));
  return {
    items: useMemo(() => r.scored.map((s) => s.item), [r.scored]),
    scored: r.scored,
    total: q.data ? r.ranked.length : undefined,
    isLoading: q.isLoading,
    isError: q.isError,
    refetch: q.refetch,
    hasNextPage: r.hasNextPage,
    isFetchingNextPage: false,
    fetchNextPage: r.fetchNextPage,
  };
}

/** Result list driven by the global filters store: repo order, or the on-device ranking when sort is `recommended`. */
export function useFilteredSearch(limit?: number) {
  const filters = useFilters((s) => s.filters);
  const recommended = filters.sort === 'recommended';
  const params = useSearchParams(filters, limit);
  const q = useSearchEvents(params);
  const candidates: SearchItem[] = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);
  const r = useRankedPages(candidates, filters.radiusKm, RECOMMENDED_PAGE, recommended, JSON.stringify(params));
  const reco = useMemo(() => r.scored.map((s) => s.item), [r.scored]);
  if (recommended) {
    return { ...q, items: reco, scored: r.scored as Scored[] | undefined, total: q.data ? r.ranked.length : undefined, hasNextPage: r.hasNextPage, isFetchingNextPage: false, fetchNextPage: r.fetchNextPage };
  }
  return { ...q, items: candidates, scored: undefined as Scored[] | undefined, total: q.data?.pages[0]?.total };
}

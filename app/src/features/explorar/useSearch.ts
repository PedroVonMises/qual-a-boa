import { useMemo } from 'react';

import { useSearchEvents } from '@/data/queries';
import { toSearchParams, type FilterState } from '@/domain/filters';
import type { SearchItem, SearchParams } from '@/domain/types';
import { useFilters } from '@/state/filters';
import { useLocation } from '@/state/location';
import { minuteNow } from './clock';

/** Search params for the given filters, anchored on the stored location. */
export function useSearchParams(filters: FilterState, limit?: number): Omit<SearchParams, 'cursor'> {
  const location = useLocation((s) => s.location);
  const now = minuteNow();
  return useMemo(() => {
    const p = toSearchParams(filters, location, now);
    return limit ? { ...p, limit } : p;
  }, [filters, location, limit, now]);
}

/** Paginated search driven by the global filters store. */
export function useFilteredSearch(limit?: number) {
  const filters = useFilters((s) => s.filters);
  const q = useSearchEvents(useSearchParams(filters, limit));
  const items: SearchItem[] = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);
  const total = q.data?.pages[0]?.total;
  return { ...q, items, total };
}

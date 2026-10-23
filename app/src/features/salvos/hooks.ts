import { useQueries } from '@tanstack/react-query';

import { getRepo } from '@/data';
import type { ArtistDetail, EventDetail, VenueDetail } from '@/domain/types';

export interface Resolved<T> {
  key: string;
  loading: boolean;
  /** null when the item no longer exists (deleted or unpublished). */
  data: T | null;
}

export function useSavedEvents(ids: string[]): Resolved<EventDetail>[] {
  return useQueries({
    queries: ids.map((id) => ({ queryKey: ['saved-event', id], queryFn: () => getRepo().getEvent(id) })),
    combine: (results) => results.map((r, i) => ({ key: ids[i], loading: r.isPending, data: r.data ?? null })),
  });
}

/** Saved artists are stored by slug. */
export function useSavedArtists(slugs: string[]): Resolved<ArtistDetail>[] {
  return useQueries({
    queries: slugs.map((s) => ({ queryKey: ['saved-artist', s], queryFn: () => getRepo().getArtist(s) })),
    combine: (results) => results.map((r, i) => ({ key: slugs[i], loading: r.isPending, data: r.data ?? null })),
  });
}

/** Saved venues are stored by slug. */
export function useSavedVenues(slugs: string[]): Resolved<VenueDetail>[] {
  return useQueries({
    queries: slugs.map((s) => ({ queryKey: ['saved-venue', s], queryFn: () => getRepo().getVenue(s) })),
    combine: (results) => results.map((r, i) => ({ key: slugs[i], loading: r.isPending, data: r.data ?? null })),
  });
}

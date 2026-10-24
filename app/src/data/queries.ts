import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { GeoPoint, SearchParams } from '@/domain/types';
import { useFeedInvalidation } from './feedStatus';
import { getRepo } from './index';

export { useFeedStatus, relativeTimePt } from './feedStatus';

type SearchBase = Omit<SearchParams, 'cursor'>;

export const queryKeys = {
  genres: ['genres'] as const,
  areas: ['areas'] as const,
  search: (p: SearchBase) => ['search', p] as const,
  event: (id: string, from?: GeoPoint) => ['event', id, from?.lat, from?.lng] as const,
  venue: (slug: string) => ['venue', slug] as const,
  artist: (slug: string, from?: GeoPoint) => ['artist', slug, from?.lat, from?.lng] as const,
  artists: (q: string) => ['artists', q] as const,
};

export function useGenres() {
  useFeedInvalidation();
  return useQuery({ queryKey: queryKeys.genres, queryFn: () => getRepo().listGenres(), staleTime: Infinity });
}

export function useAreas() {
  useFeedInvalidation();
  return useQuery({ queryKey: queryKeys.areas, queryFn: () => getRepo().listAreas(), staleTime: Infinity });
}

export function useSearchEvents(params: SearchBase) {
  useFeedInvalidation();
  return useInfiniteQuery({
    queryKey: queryKeys.search(params),
    queryFn: ({ pageParam }) => getRepo().searchEvents({ ...params, cursor: pageParam }),
    initialPageParam: null as string | null,
    placeholderData: keepPreviousData,
    getNextPageParam: (last) => last.nextCursor,
  });
}

export const useEvent = (id: string | undefined, from?: GeoPoint) =>
  useQuery({
    queryKey: queryKeys.event(id ?? '', from),
    queryFn: () => getRepo().getEvent(id!, from),
    enabled: !!id,
  });

export const useVenue = (slug: string | undefined) =>
  useQuery({ queryKey: queryKeys.venue(slug ?? ''), queryFn: () => getRepo().getVenue(slug!), enabled: !!slug });

export const useArtist = (slug: string | undefined, from?: GeoPoint) =>
  useQuery({
    queryKey: queryKeys.artist(slug ?? '', from),
    queryFn: () => getRepo().getArtist(slug!, from),
    enabled: !!slug,
  });

export const useArtistSearch = (q: string) =>
  useQuery({
    queryKey: queryKeys.artists(q),
    queryFn: () => getRepo().searchArtists(q),
    enabled: q.trim().length > 0,
  });

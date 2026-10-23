import type {
  Artist,
  ArtistDetail,
  EventDetail,
  GeoPoint,
  Genre,
  SearchPage,
  SearchParams,
  VenueDetail,
} from '@/domain/types';

/**
 * The integration seam between UI and data. Two implementations:
 * - SeedRepo (data/seedRepo.ts): in-memory over data/seed.json, default, no network.
 * - SupabaseRepo (data/supabaseRepo.ts): calls the `search_events` RPC and tables.
 * Both must return identical results for the shared fixtures in supabase/tests.
 * Selected by EXPO_PUBLIC_DATA_SOURCE=seed|supabase (see lib/env.ts).
 */
export interface Repo {
  listGenres(): Promise<Genre[]>;
  listAreas(): Promise<string[]>;
  searchEvents(params: SearchParams): Promise<SearchPage>;
  getEvent(id: string, from?: GeoPoint): Promise<EventDetail | null>;
  getVenue(slug: string): Promise<VenueDetail | null>;
  getArtist(slug: string, from?: GeoPoint): Promise<ArtistDetail | null>;
  searchArtists(query: string, limit?: number): Promise<Artist[]>;
}

/** Waves 2-3 extend this with: favorites sync, follows, reports, reviews, support tickets. */

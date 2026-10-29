// Domain types shared by seed data, the Supabase repo, the UI and tests.
// Money is in BRL reais (not cents). Dates are ISO 8601 strings in UTC.

import type { AccessTag } from './accessTags';

export type VenueStatus = 'open' | 'closed' | 'unverified';
export type EventStatus = 'published' | 'cancelled' | 'draft';
/** `recommended` is client-only (domain/recommend.ts): repos and SQL never receive it. */
export type SortKey = 'distance' | 'price' | 'date' | 'popularity' | 'recommended';

/**
 * Key of a drawn cover (see ui/art). Either a legacy venue-identity key (LEGACY_COVER_KEYS) or a generated
 * `art:<template>:<palette>:<variant>` key from domain/cover.ts. Unknown keys fall back to the generic art.
 */
export type CoverKey = string;

export const LEGACY_COVER_KEYS = ['bolt', 'selva', 'gordinho', 'pub426', 'caipora', 'fluente', 'mare', 'generic'] as const;

export interface Genre {
  id: string;
  slug: string; // 'funk', 'pagode-samba', 'eletronica', ...
  label: string; // pt-BR label
}

export interface Artist {
  id: string;
  slug: string;
  name: string;
  genreSlugs: string[];
  photoUrl?: string;
}

export interface Venue {
  id: string;
  slug: string;
  name: string;
  area: string; // 'Praia do Canto', 'Jardim da Penha', 'Centro', 'Camburi', 'Vila Velha'
  city: string;
  address?: string;
  lat: number;
  lng: number;
  status: VenueStatus;
  adultOnly: boolean;
  genreSlugs: string[];
  /** Vibe & access tags the venue declares (demonstration data until verified). */
  accessTags?: AccessTag[];
  hours?: string; // free text for MVP, e.g. 'Sex e sáb, 23h–06h'
  coverKey: CoverKey;
  /** True while data is a design placeholder, not verified with the venue. */
  placeholder: boolean;
}

export interface EventItem {
  id: string;
  title: string;
  venueId: string;
  startsAt: string;
  endsAt?: string;
  priceMin: number | null;
  priceMax: number | null;
  isFree: boolean;
  ticketUrl?: string; // external; opened with expo-web-browser
  ageMin: number; // 18 for MVP
  genreSlugs: string[];
  /** Extra tags for this night (themed events). Rows from search_events carry the effective set. */
  accessTags?: AccessTag[];
  artistIds: string[]; // in billing order
  status: EventStatus;
  coverKey: CoverKey;
  /** Organizer-supplied poster (https). Only with permission; the illustrated cover is the fallback. */
  imageUrl?: string;
  popularity: number; // 0..100, curated for MVP
}

export interface SearchParams {
  lat: number;
  lng: number;
  radiusKm: number;
  genreSlugs?: string[];
  tags?: string[]; // every tag must match (AND) against the venue's plus the event's tags
  priceMax?: number; // 0 means only free
  dateFrom?: string;
  dateTo?: string;
  artistId?: string;
  area?: string;
  query?: string; // matches event title, venue name, artist name
  sort: SortKey;
  limit?: number; // default 20
  cursor?: string | null; // opaque; offset-based in MVP (cursor = String(offset))
  now?: string; // ISO; "current time" for filtering past events. Default: real now. Tests pass a fixed value.
}

/** Whole dataset: output of supabase/seed (app/src/data/seed.json) and input of SeedRepo. */
export interface SeedDataset {
  generatedAt: string;
  genres: Genre[];
  venues: Venue[];
  artists: Artist[];
  events: EventItem[]; // includes past events (used for "já passaram por aqui")
}

export interface SearchItem {
  event: EventItem;
  venue: Venue;
  distanceKm: number;
}

export interface SearchPage {
  items: SearchItem[];
  nextCursor: string | null;
  total: number;
}

export interface EventDetail {
  event: EventItem;
  venue: Venue;
  lineup: Artist[];
  distanceKm: number | null;
}

export interface PastArtist {
  artist: Artist;
  lastPlayedAt: string; // ISO date of the most recent past event at this venue
  times: number;
}

export interface VenueDetail {
  venue: Venue;
  upcoming: EventItem[];
  pastArtists: PastArtist[];
}

export interface ArtistDetail {
  artist: Artist;
  upcoming: SearchItem[];
  playedAt: { venue: Venue; lastPlayedAt: string }[];
}

/** Where distances are measured from. Default: Praia do Canto, Vitória. */
export interface GeoPoint {
  lat: number;
  lng: number;
  label: string;
}

export const DEFAULT_LOCATION: GeoPoint = {
  lat: -20.2976,
  lng: -40.2958,
  label: 'Praia do Canto, Vitória',
};

// Contracts for the on-device recommender (Wave 6). Implementation lives in domain/recommend.ts (pure functions).
import type { SearchItem } from './types';

/** What the user likes, built from favorites, follows, check-ins, reviews and implicit signals (state/taste.ts). */
export interface TasteProfile {
  genreWeights: Record<string, number>; // slug -> 0..1
  artistSlugs: string[]; // favorited or followed artists
  venueSlugs: string[]; // favorited, checked-in or well reviewed venues
  /** Same artists by id (events carry artist ids, not slugs); matched together with artistSlugs. */
  artistIds?: string[];
  /** Same venues by id; matched together with venueSlugs. */
  venueIds?: string[];
  priceMedian: number | null; // BRL, from followed/favorited events
  /** Count of distinct signals; drives the cold-start confidence (min(1, signals / 5)). */
  signals: number;
}

export interface RecoContext {
  profile: TasteProfile;
  radiusKm: number;
}

export type ReasonKind = 'taste' | 'artist' | 'venue' | 'near' | 'time' | 'hot' | 'price';

/** pt-BR text tag shown on a card; always text, never color only. */
export interface Reason {
  kind: ReasonKind;
  text: string;
}

export interface Scored {
  item: SearchItem;
  score: number; // 0..1
  reasons: Reason[];
}

export const EMPTY_PROFILE: TasteProfile = { genreWeights: {}, artistSlugs: [], venueSlugs: [], priceMedian: null, signals: 0 };

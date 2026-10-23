import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Saved items. Convention: events are stored by id; venues and artists by SLUG
 * (slugs are stable across the seed data and Supabase). `venueIds` keeps its name for compatibility
 * but holds venue slugs.
 */
interface FavoritesStore {
  eventIds: string[];
  venueIds: string[];
  artistSlugs: string[];
  toggleEvent: (id: string) => void;
  toggleVenue: (slug: string) => void;
  toggleArtist: (slug: string) => void;
  isEventFavorite: (id: string) => boolean;
  isVenueFavorite: (slug: string) => boolean;
  isArtistFavorite: (slug: string) => boolean;
}

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

export const useFavorites = create<FavoritesStore>()(
  persist(
    (set, get) => ({
      eventIds: [],
      venueIds: [],
      artistSlugs: [],
      toggleEvent: (id) => set((s) => ({ eventIds: toggle(s.eventIds, id) })),
      toggleVenue: (slug) => set((s) => ({ venueIds: toggle(s.venueIds, slug) })),
      toggleArtist: (slug) => set((s) => ({ artistSlugs: toggle(s.artistSlugs, slug) })),
      isEventFavorite: (id) => get().eventIds.includes(id),
      isVenueFavorite: (slug) => get().venueIds.includes(slug),
      isArtistFavorite: (slug) => get().artistSlugs.includes(slug),
    }),
    {
      name: 'qab.favorites',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ eventIds: s.eventIds, venueIds: s.venueIds, artistSlugs: s.artistSlugs }),
    },
  ),
);

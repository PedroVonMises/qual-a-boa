import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface FavoritesStore {
  eventIds: string[];
  venueIds: string[];
  toggleEvent: (id: string) => void;
  toggleVenue: (id: string) => void;
  isEventFavorite: (id: string) => boolean;
  isVenueFavorite: (id: string) => boolean;
}

const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

export const useFavorites = create<FavoritesStore>()(
  persist(
    (set, get) => ({
      eventIds: [],
      venueIds: [],
      toggleEvent: (id) => set((s) => ({ eventIds: toggle(s.eventIds, id) })),
      toggleVenue: (id) => set((s) => ({ venueIds: toggle(s.venueIds, id) })),
      isEventFavorite: (id) => get().eventIds.includes(id),
      isVenueFavorite: (id) => get().venueIds.includes(id),
    }),
    {
      name: 'qab.favorites',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ eventIds: s.eventIds, venueIds: s.venueIds }),
    },
  ),
);

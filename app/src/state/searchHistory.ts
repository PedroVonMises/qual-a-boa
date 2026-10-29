import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { safeMerge } from './safeMerge';

export const SEARCH_HISTORY_MAX = 8;
const QUERY_MAX = 80;

/** Case- and accent-insensitive key, so "Pagode" and "pagode " are the same search. */
export function searchKey(q: string): string {
  return q
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

/** Newest first, deduplicated, capped. Exported for tests. */
export function pushRecent(list: string[], query: string, max: number = SEARCH_HISTORY_MAX): string[] {
  const q = query.trim().replace(/\s+/g, ' ').slice(0, QUERY_MAX);
  if (!q) return list;
  const key = searchKey(q);
  return [q, ...list.filter((x) => searchKey(x) !== key)].slice(0, max);
}

interface SearchHistoryStore {
  recent: string[];
  add: (query: string) => void;
  remove: (query: string) => void;
  clear: () => void;
}

/** Recent searches. Device-only: never synced or exported (it is a convenience cache, not a user record). */
export const useSearchHistory = create<SearchHistoryStore>()(
  persist(
    (set) => ({
      recent: [],
      add: (query) => set((s) => ({ recent: pushRecent(s.recent, query) })),
      remove: (query) => set((s) => ({ recent: s.recent.filter((x) => searchKey(x) !== searchKey(query)) })),
      clear: () => set({ recent: [] }),
    }),
    {
      name: 'qab.searchHistory',
      merge: (persisted, current) => safeMerge(persisted, current),
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ recent: s.recent }),
    },
  ),
);

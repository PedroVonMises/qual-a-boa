import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { safeMerge } from './safeMerge';

/** Implicit taste signals (never leave the device). Explicit ones (favorites, follows, ...) live in their own stores. */
export type ViewKind = 'event' | 'venue' | 'artist';

export interface ViewSignal {
  kind: ViewKind;
  /** Event id, venue slug or artist slug. */
  id: string;
  at: number;
}

export interface GenreSignal {
  w: number;
  at: number;
}

export const HALF_LIFE_MS = 14 * 86_400_000;
export const MAX_GENRE_WEIGHT = 5;
export const MAX_GENRES = 20;
export const MAX_VIEWS = 30;

/** Weight after exponential decay (half-life 14 days). */
export function decayed(w: number, at: number, nowMs: number): number {
  const age = Math.max(0, nowMs - at);
  return w * Math.pow(0.5, age / HALF_LIFE_MS);
}

export function addGenre(genres: Record<string, GenreSignal>, slug: string, nowMs: number): Record<string, GenreSignal> {
  const prev = genres[slug];
  const w = Math.min(MAX_GENRE_WEIGHT, (prev ? decayed(prev.w, prev.at, nowMs) : 0) + 1);
  const next = { ...genres, [slug]: { w, at: nowMs } };
  const keys = Object.keys(next);
  if (keys.length <= MAX_GENRES) return next;
  // Drop the weakest (decayed) signal.
  const weakest = keys.sort((a, b) => decayed(next[a].w, next[a].at, nowMs) - decayed(next[b].w, next[b].at, nowMs))[0];
  delete next[weakest];
  return next;
}

export function addView(views: ViewSignal[], kind: ViewKind, id: string, nowMs: number): ViewSignal[] {
  const rest = views.filter((v) => !(v.kind === kind && v.id === id));
  return [{ kind, id, at: nowMs }, ...rest].slice(0, MAX_VIEWS);
}

interface TasteStore {
  genres: Record<string, GenreSignal>;
  /** Most recent first, deduped, capped. */
  views: ViewSignal[];
  recordGenreFilter: (slug: string, nowMs?: number) => void;
  recordView: (kind: ViewKind, id: string, nowMs?: number) => void;
  reset: () => void;
}

export const useTaste = create<TasteStore>()(
  persist(
    (set) => ({
      genres: {},
      views: [],
      recordGenreFilter: (slug, nowMs = Date.now()) => set((s) => ({ genres: addGenre(s.genres, slug, nowMs) })),
      recordView: (kind, id, nowMs = Date.now()) => set((s) => ({ views: addView(s.views, kind, id, nowMs) })),
      reset: () => set({ genres: {}, views: [] }),
    }),
    {
      name: 'qab.taste',
      merge: (persisted, current) => safeMerge(persisted, current),
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ genres: s.genres, views: s.views }),
    },
  ),
);

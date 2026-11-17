import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { pushCheckin } from '@/data/sync/checkins';

import { safeMerge } from './safeMerge';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { CheckinPosition } from '@/domain/checkin';
import type { Checkin } from '@/domain/engage';

/** Idempotent: one check-in per event (the first one wins). */
export function addCheckin(list: Checkin[], eventId: string, nowIso: string): Checkin[] {
  return list.some((c) => c.eventId === eventId) ? list : [...list, { eventId, at: nowIso }];
}

export const hasCheckin = (list: Checkin[], eventId: string) => list.some((c) => c.eventId === eventId);

interface CheckinsStore {
  checkins: Checkin[];
  /** Event ids whose check-in the server rejected (window closed etc.). Kept locally, never retried. */
  unsynced: string[];
  /** Call only after the proximity check passed (see domain/checkin.ts); `pos` goes to the server for its own check. */
  checkIn: (eventId: string, nowIso?: string, pos?: CheckinPosition) => void;
  hasCheckedIn: (eventId: string) => boolean;
}

export const useCheckins = create<CheckinsStore>()(
  persist(
    (set, get) => ({
      checkins: [],
      unsynced: [],
      checkIn: (eventId, nowIso = new Date().toISOString(), pos) => {
        const had = hasCheckin(get().checkins, eventId);
        set((s) => ({ checkins: addCheckin(s.checkins, eventId, nowIso) }));
        if (!had) void pushCheckin(eventId, pos);
      },
      hasCheckedIn: (eventId) => hasCheckin(get().checkins, eventId),
    }),
    {
      name: 'qab.checkins',
      merge: (persisted, current) => safeMerge(persisted, current),
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ checkins: s.checkins, unsynced: s.unsynced }),
    },
  ),
);

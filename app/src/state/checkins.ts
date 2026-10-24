import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { safeMerge } from './safeMerge';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Checkin } from '@/domain/engage';

/** Idempotent: one check-in per event (the first one wins). */
export function addCheckin(list: Checkin[], eventId: string, nowIso: string): Checkin[] {
  return list.some((c) => c.eventId === eventId) ? list : [...list, { eventId, at: nowIso }];
}

export const hasCheckin = (list: Checkin[], eventId: string) => list.some((c) => c.eventId === eventId);

interface CheckinsStore {
  checkins: Checkin[];
  checkIn: (eventId: string, nowIso?: string) => void;
  hasCheckedIn: (eventId: string) => boolean;
}

export const useCheckins = create<CheckinsStore>()(
  persist(
    (set, get) => ({
      checkins: [],
      checkIn: (eventId, nowIso = new Date().toISOString()) => set((s) => ({ checkins: addCheckin(s.checkins, eventId, nowIso) })),
      hasCheckedIn: (eventId) => hasCheckin(get().checkins, eventId),
    }),
    {
      name: 'qab.checkins',
      merge: (persisted, current) => safeMerge(persisted, current),
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ checkins: s.checkins }),
    },
  ),
);

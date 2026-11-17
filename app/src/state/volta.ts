import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { TRUSTED_CONTACTS_MAX, type TripPlace, type TrustedContact } from '@/domain/volta';
import { safeMerge } from './safeMerge';

export interface Trip {
  startedAt: string;
  place: TripPlace | null;
  eventId?: string;
  /** When the local reminder fires, if one was scheduled. */
  remindAt?: string;
  reminderId?: string;
}

interface VoltaStore {
  contacts: TrustedContact[];
  trip: Trip | null;
  addContact: (c: Omit<TrustedContact, 'id'>) => void;
  removeContact: (id: string) => void;
  startTrip: (t: Trip) => void;
  endTrip: () => void;
  reset: () => void;
}

let seq = 0;
const newId = () => `c${Date.now().toString(36)}${(seq++).toString(36)}`;

/** "Cheguei em casa" (S5). Device-only: never synced; included in the export and cleared by "Apagar meus dados". */
export const useVolta = create<VoltaStore>()(
  persist(
    (set) => ({
      contacts: [],
      trip: null,
      addContact: (c) =>
        set((s) => (s.contacts.length >= TRUSTED_CONTACTS_MAX ? s : { contacts: [...s.contacts, { ...c, id: newId() }] })),
      removeContact: (id) => set((s) => ({ contacts: s.contacts.filter((c) => c.id !== id) })),
      startTrip: (trip) => set({ trip }),
      endTrip: () => set({ trip: null }),
      reset: () => set({ contacts: [], trip: null }),
    }),
    {
      name: 'qab.volta',
      merge: (persisted, current) => safeMerge(persisted, current),
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ contacts: s.contacts, trip: s.trip }),
    },
  ),
);

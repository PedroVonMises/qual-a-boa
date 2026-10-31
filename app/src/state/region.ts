import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEFAULT_UF, isPilotUf, type Uf } from '@/domain/region';
import { safeMerge } from './safeMerge';

/** The state (UF) whose conversations the Comunidade shows. Only pilot states can be chosen. */
interface RegionStore {
  uf: Uf;
  /** Returns false (and changes nothing) when the state is not open yet. */
  setUf: (uf: string) => boolean;
}

export const useRegion = create<RegionStore>()(
  persist(
    (set) => ({
      uf: DEFAULT_UF,
      setUf: (uf) => {
        if (!isPilotUf(uf)) return false;
        set({ uf });
        return true;
      },
    }),
    {
      name: 'qab.region',
      // A stored state that is unknown, or no longer open, falls back to the default instead of breaking the feed.
      merge: (persisted, current) => {
        const merged = safeMerge(persisted, current);
        return isPilotUf(merged.uf) ? merged : { ...merged, uf: DEFAULT_UF };
      },
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ uf: s.uf }),
    },
  ),
);

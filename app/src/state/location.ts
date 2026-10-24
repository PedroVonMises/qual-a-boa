import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { safeMerge } from './safeMerge';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_LOCATION, type GeoPoint } from '@/domain/types';

interface LocationStore {
  location: GeoPoint;
  /** True when the user chose or granted a location (vs. the Praia do Canto default). */
  isCustom: boolean;
  setLocation: (loc: GeoPoint) => void;
  resetLocation: () => void;
}

export const useLocation = create<LocationStore>()(
  persist(
    (set) => ({
      location: DEFAULT_LOCATION,
      isCustom: false,
      setLocation: (location) => set({ location, isCustom: true }),
      resetLocation: () => set({ location: DEFAULT_LOCATION, isCustom: false }),
    }),
    { name: 'qab.location', merge: (persisted, current) => safeMerge(persisted, current), storage: createJSONStorage(() => AsyncStorage) },
  ),
);

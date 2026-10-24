import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { safeMerge } from './safeMerge';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEFAULT_LOCATION, type GeoPoint } from '@/domain/types';
import { isInPilotArea } from '@/lib/location/pilot';
import type { DeviceFix, LocationPermission, LocationSource } from '@/lib/location/types';

interface LocationStore {
  /** Point used for search; stays DEFAULT_LOCATION when the device is outside the pilot area. */
  location: GeoPoint;
  /** True when the user chose an area or a device fix is in use (kept in sync with `source`). */
  isCustom: boolean;
  source: LocationSource;
  permission: LocationPermission;
  /** Epoch ms of the last device fix; 0 = never. */
  updatedAt: number;
  /** Fix accuracy in meters; 0 = unknown. */
  accuracyM: number;
  /** Device is outside the pilot area: UI says "Fora da área piloto (Grande Vitória)". */
  outsidePilot: boolean;
  setLocation: (loc: GeoPoint) => void;
  setArea: (loc: GeoPoint) => void;
  setDeviceFix: (fix: DeviceFix) => void;
  setPermission: (p: LocationPermission) => void;
  resetLocation: () => void;
}

export const useLocation = create<LocationStore>()(
  persist(
    (set) => ({
      location: DEFAULT_LOCATION,
      isCustom: false,
      source: 'default',
      permission: 'undetermined',
      updatedAt: 0,
      accuracyM: 0,
      outsidePilot: false,
      setLocation: (location) => set({ location, isCustom: true, source: 'area', outsidePilot: false, accuracyM: 0 }),
      setArea: (location) => set({ location, isCustom: true, source: 'area', outsidePilot: false, accuracyM: 0 }),
      setDeviceFix: (fix) => {
        const at = Date.parse(fix.at);
        const base = {
          source: 'device' as const,
          permission: 'granted' as const,
          updatedAt: Number.isFinite(at) ? at : Date.now(),
          accuracyM: fix.accuracyM ?? 0,
        };
        if (isInPilotArea(fix.point)) set({ ...base, location: fix.point, isCustom: true, outsidePilot: false });
        else set({ ...base, location: DEFAULT_LOCATION, isCustom: false, outsidePilot: true });
      },
      setPermission: (permission) => set({ permission }),
      resetLocation: () =>
        set({ location: DEFAULT_LOCATION, isCustom: false, source: 'default', updatedAt: 0, accuracyM: 0, outsidePilot: false }),
    }),
    { name: 'qab.location', merge: (persisted, current) => safeMerge(persisted, current), storage: createJSONStorage(() => AsyncStorage) },
  ),
);

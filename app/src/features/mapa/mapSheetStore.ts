import { create } from 'zustand';

import type { MapSheetIndex } from '@/ui';

/** Last MapSheet state, remembered for the session only (not persisted): the app always opens on "Dividido". */
interface MapSheetStore {
  index: MapSheetIndex;
  setIndex: (index: MapSheetIndex) => void;
}

export const useMapSheet = create<MapSheetStore>((set) => ({
  index: 1,
  setIndex: (index) => set({ index }),
}));

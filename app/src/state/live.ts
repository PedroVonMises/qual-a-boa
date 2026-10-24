import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { safeMerge } from './safeMerge';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { CrowdLevel, LiveReport, MusicLevel, QueueLevel } from '@/domain/engage';

export const MAX_REPORTS = 200;
export const MAX_DOOR_PRICE = 1000;

export interface ReportInput {
  eventId: string;
  queue?: QueueLevel;
  crowd?: CrowdLevel;
  music?: MusicLevel;
  priceAtDoor?: number;
}

export function validPrice(p: number | undefined): number | undefined {
  return typeof p === 'number' && Number.isFinite(p) && p >= 0 && p <= MAX_DOOR_PRICE ? Math.round(p * 100) / 100 : undefined;
}

/** True when the input carries at least one usable signal. */
export function hasSignal(i: Omit<ReportInput, 'eventId'>): boolean {
  return !!(i.queue || i.crowd || i.music || validPrice(i.priceAtDoor) !== undefined);
}

export function buildReport(input: ReportInput, id: string, nowIso: string): LiveReport | null {
  if (!hasSignal(input)) return null;
  const r: LiveReport = { id, eventId: input.eventId, at: nowIso };
  if (input.queue) r.queue = input.queue;
  if (input.crowd) r.crowd = input.crowd;
  if (input.music) r.music = input.music;
  const price = validPrice(input.priceAtDoor);
  if (price !== undefined) r.priceAtDoor = price;
  return r;
}

/** Appends (de-duplicated by id), oldest dropped first, capped. */
export function addReport(list: LiveReport[], r: LiveReport): LiveReport[] {
  if (list.some((x) => x.id === r.id)) return list;
  return [...list, r].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).slice(-MAX_REPORTS);
}

export const reportsFor = (list: LiveReport[], eventId: string) => list.filter((r) => r.eventId === eventId);

interface LiveStore {
  /** Reports made on this device. Community reports arrive with the backend (migration 0005). */
  reports: LiveReport[];
  report: (input: ReportInput, nowIso?: string) => LiveReport | null;
}

let seq = 0;

export const useLive = create<LiveStore>()(
  persist(
    (set, get) => ({
      reports: [],
      report: (input, nowIso = new Date().toISOString()) => {
        seq += 1;
        const r = buildReport(input, `local-${Date.parse(nowIso)}-${seq}-${Math.random().toString(36).slice(2, 7)}`, nowIso);
        if (r) set({ reports: addReport(get().reports, r) });
        return r;
      },
    }),
    {
      name: 'qab.live',
      merge: (persisted, current) => safeMerge(persisted, current),
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ reports: s.reports }),
    },
  ),
);

// Contracts for the location service (Wave 6). Implementation in lib/location/index.ts (expo-location).
import type { GeoPoint } from '@/domain/types';

/** 'blocked' = denied and the OS will not ask again (user must open Settings). */
export type LocationPermission = 'undetermined' | 'granted' | 'denied' | 'blocked';

/** Where the current location came from. */
export type LocationSource = 'default' | 'area' | 'device';

export interface DeviceFix {
  point: GeoPoint; // label already resolved ("Jardim da Penha" or the "Perto de você" fallback)
  accuracyM: number | null; // coarse (approximate) grants report large values
  at: string; // ISO
}

export type FixResult = { ok: true; fix: DeviceFix } | { ok: false; reason: 'denied' | 'blocked' | 'unavailable' | 'timeout' };

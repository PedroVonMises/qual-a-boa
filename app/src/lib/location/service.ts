import * as Location from 'expo-location';
import { Linking } from 'react-native';

import { FALLBACK_LABEL } from './pilot';
import type { DeviceFix, FixResult, LocationPermission } from './types';

export const FIX_TIMEOUT_MS = 8000;
const GEOCODE_TIMEOUT_MS = 4000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

function mapPermission(r: { granted: boolean; canAskAgain: boolean; status?: string }): LocationPermission {
  if (r.granted) return 'granted';
  if (r.status === 'undetermined') return 'undetermined';
  return r.canAskAgain === false ? 'blocked' : 'denied';
}

export async function getPermission(): Promise<LocationPermission> {
  try {
    return mapPermission(await Location.getForegroundPermissionsAsync());
  } catch {
    return 'undetermined';
  }
}

export async function requestPermission(): Promise<LocationPermission> {
  try {
    const p = mapPermission(await Location.requestForegroundPermissionsAsync());
    return p === 'undetermined' ? 'denied' : p;
  } catch {
    return 'denied';
  }
}

export async function openSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    // Settings unavailable (e.g. web): nothing to do.
  }
}

/** Neighbourhood label for a point; never throws. */
export async function labelFor(point: { lat: number; lng: number }): Promise<string> {
  try {
    const res = await withTimeout(
      Location.reverseGeocodeAsync({ latitude: point.lat, longitude: point.lng }),
      GEOCODE_TIMEOUT_MS,
    );
    const a = res?.[0];
    const label = (a?.district || a?.subregion || '').trim();
    return label || FALLBACK_LABEL;
  } catch {
    return FALLBACK_LABEL;
  }
}

export async function fixFromCoords(
  coords: { latitude: number; longitude: number; accuracy: number | null },
  at: number,
): Promise<DeviceFix> {
  const point = { lat: coords.latitude, lng: coords.longitude };
  return {
    point: { ...point, label: await labelFor(point) },
    accuracyM: typeof coords.accuracy === 'number' ? coords.accuracy : null,
    at: new Date(at).toISOString(),
  };
}

/** Current position (8s, Balanced), falling back to the last known one. Requires an existing grant. */
export async function getFix(): Promise<FixResult> {
  const perm = await getPermission();
  if (perm === 'blocked') return { ok: false, reason: 'blocked' };
  if (perm !== 'granted') return { ok: false, reason: 'denied' };
  let timedOut = false;
  try {
    const pos = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), FIX_TIMEOUT_MS);
    return { ok: true, fix: await fixFromCoords(pos.coords, pos.timestamp || Date.now()) };
  } catch (e) {
    timedOut = e instanceof Error && e.message === 'timeout';
  }
  try {
    const last = await Location.getLastKnownPositionAsync();
    if (last) return { ok: true, fix: await fixFromCoords(last.coords, last.timestamp || Date.now()) };
  } catch {
    // fall through
  }
  return { ok: false, reason: timedOut ? 'timeout' : 'unavailable' };
}

import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useLocation } from '@/state/location';
import { fixFromCoords, getFix, getPermission, requestPermission } from './service';
import type { DeviceFix, FixResult } from './types';

export const STALE_MS = 10 * 60 * 1000;

let inflight: Promise<FixResult> | null = null;

/**
 * Permission (asked when `ask` and still askable) + fix, written to the location store.
 * Coordinates stay on the device; nothing is logged or sent.
 */
export function refreshDeviceLocation(ask: boolean): Promise<FixResult> {
  if (inflight) return inflight;
  const run = async (): Promise<FixResult> => {
    const { setPermission, setDeviceFix } = useLocation.getState();
    let perm = await getPermission();
    if (perm !== 'granted' && ask && (perm === 'undetermined' || perm === 'denied')) perm = await requestPermission();
    setPermission(perm);
    if (perm !== 'granted') return { ok: false, reason: perm === 'blocked' ? 'blocked' : 'denied' };
    const res = await getFix();
    if (res.ok) setDeviceFix(res.fix);
    return res;
  };
  inflight = run().finally(() => {
    inflight = null;
  });
  return inflight;
}

/** Mount once (root layout): refreshes a stale device fix when the app returns to the foreground. */
export function useLocationRefresh(): void {
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const s = useLocation.getState();
      if (s.source !== 'device') return;
      if (Date.now() - s.updatedAt <= STALE_MS) return;
      void refreshDeviceLocation(false);
    });
    return () => sub.remove();
  }, []);
}

/** Live position while `enabled` (Mapa focused). Updates the store only when the source is the device. */
export function useLocationWatch(enabled: boolean): DeviceFix | null {
  const [fix, setFix] = useState<DeviceFix | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let sub: { remove: () => void } | null = null;
    (async () => {
      if ((await getPermission()) !== 'granted') return;
      try {
        const s = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 50 },
          async (pos) => {
            const next = await fixFromCoords(pos.coords, pos.timestamp || Date.now());
            if (cancelled) return;
            setFix(next);
            if (useLocation.getState().source === 'device') useLocation.getState().setDeviceFix(next);
          },
        );
        if (cancelled) s.remove();
        else sub = s;
      } catch {
        // watch unavailable: the last stored fix stays.
      }
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [enabled]);
  return fix;
}

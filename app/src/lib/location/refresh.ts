import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useLocation } from '@/state/location';
import { fixFromCoords, getFix, getPermission, requestPermission } from './service';
import type { DeviceFix, FixResult } from './types';

export const STALE_MS = 10 * 60 * 1000;

let inflight: Promise<FixResult> | null = null;

/**
 * Permission (asked when `ask` and still askable) + fix, written to the location store (`live`).
 * `prefer` (defaults to `ask`: an explicit "use my location" tap) also switches the preferred origin to 'live'.
 * Coordinates stay on the device; nothing is logged or sent.
 */
export function refreshDeviceLocation(ask: boolean, prefer: boolean = ask): Promise<FixResult> {
  if (inflight) {
    if (prefer) void inflight.then((r) => r.ok && useLocation.getState().setPreferred('live'));
    return inflight;
  }
  const run = async (): Promise<FixResult> => {
    const { setPermission, setDeviceFix } = useLocation.getState();
    let perm = await getPermission();
    if (perm !== 'granted' && ask && (perm === 'undetermined' || perm === 'denied')) perm = await requestPermission();
    setPermission(perm);
    if (perm !== 'granted') return { ok: false, reason: perm === 'blocked' ? 'blocked' : 'denied' };
    const res = await getFix();
    if (res.ok) {
      setDeviceFix(res.fix);
      if (prefer) useLocation.getState().setPreferred('live');
    }
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
      if (s.preferred !== 'live' || s.permission !== 'granted') return;
      if (Date.now() - s.updatedAt <= STALE_MS) return;
      void refreshDeviceLocation(false);
    });
    return () => sub.remove();
  }, []);
}

/** Live position while `enabled`. Every fix updates `live` in the store (the preferred origin is left alone). */
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
            useLocation.getState().setDeviceFix(next);
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

/** Tabs whose screens show the live position. */
const WATCH_TABS = new Set(['index', 'mapa']);

/** True when the focused tab route (expo-router pathname: "/", "/mapa", "/(tabs)/mapa"...) is Explorar or Mapa. */
export function isWatchedTab(pathname: string): boolean {
  const last = pathname.split('/').filter((p) => p && !p.startsWith('(')).pop() ?? 'index';
  return WATCH_TABS.has(last);
}

function useAppActive(): boolean {
  const [active, setActive] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  return active;
}

/**
 * Mount once in the tabs layout: watches the device position only while the app is in the foreground, the user
 * prefers the live location, permission is granted and the focused tab is Explorar or Mapa.
 */
export function useForegroundLocationWatch(pathname: string): DeviceFix | null {
  const active = useAppActive();
  const preferred = useLocation((s) => s.preferred);
  const permission = useLocation((s) => s.permission);
  return useLocationWatch(active && preferred === 'live' && permission === 'granted' && isWatchedTab(pathname));
}

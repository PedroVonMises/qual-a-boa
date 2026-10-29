import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

/**
 * Online state as TanStack Query sees it, so the banner and paused queries always agree.
 * Web: driven by the browser's online/offline events. Native: stays "online" until a connectivity source
 * (e.g. @react-native-community/netinfo) calls `onlineManager.setEventListener`.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (cb) => onlineManager.subscribe(cb),
    () => onlineManager.isOnline(),
    () => true,
  );
}

/** Web only: re-reads navigator.onLine (the retry button), so a missed `online` event cannot leave the app stuck. */
export function recheckOnline(): boolean {
  const nav = (globalThis as { navigator?: { onLine?: boolean } }).navigator;
  if (typeof nav?.onLine === 'boolean') onlineManager.setOnline(nav.onLine);
  return onlineManager.isOnline();
}

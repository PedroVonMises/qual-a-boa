import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useSyncExternalStore } from 'react';

import { FeedRepo, type FeedSource } from './feedRepo';
import { getRepo } from './index';

export interface UseFeedStatus {
  /** True only when the app reads the static feed (EXPO_PUBLIC_DATA_SOURCE=feed). */
  enabled: boolean;
  updatedAt: string | null;
  source: FeedSource;
  refreshing: boolean;
  /** Forces a fetch now. Resolves true when the data changed. */
  refresh: () => Promise<boolean>;
}

const OFF = { updatedAt: null, source: 'seed' as FeedSource, refreshing: false };
const noopSubscribe = () => () => undefined;
const offSnapshot = () => OFF;

function feedRepo(): FeedRepo | null {
  const repo = getRepo();
  return repo instanceof FeedRepo ? repo : null;
}

export function useFeedStatus(): UseFeedStatus {
  const feed = feedRepo();
  // The third argument is the server snapshot: the static web export renders every route at build time and React
  // throws without it. The server never has a feed, so it always sees OFF.
  const snap = useSyncExternalStore(
    feed ? feed.subscribe : noopSubscribe,
    feed ? feed.getStatus : offSnapshot,
    offSnapshot,
  );
  const refresh = useCallback(() => (feed ? feed.refresh({ force: true }) : Promise.resolve(false)), [feed]);
  return { enabled: !!feed, updatedAt: snap.updatedAt, source: snap.source, refreshing: snap.refreshing, refresh };
}

const attached = new WeakMap<QueryClient, FeedRepo>();

/**
 * Invalidates every react-query cache when the feed swaps in a different dataset. Idempotent per client, so the
 * data hooks can all call it. A no-op unless the data source is the feed.
 */
export function useFeedInvalidation(): void {
  const client = useQueryClient();
  const feed = feedRepo();
  useEffect(() => {
    if (!feed || attached.get(client) === feed) return;
    attached.set(client, feed);
    let last = feed.getVersion();
    // Stays subscribed for the life of the client: hooks that mount later must not lose invalidation.
    feed.subscribe(() => {
      const v = feed.getVersion();
      if (v === last) return;
      last = v;
      void client.invalidateQueries();
    });
  }, [client, feed]);
}

/** "agora há pouco", "há 5 min", "há 2 h", "há 3 d". */
export function relativeTimePt(iso: string | null, nowMs: number = Date.now()): string {
  if (!iso) return 'nunca';
  const diff = Math.max(0, nowMs - Date.parse(iso));
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'agora há pouco';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}

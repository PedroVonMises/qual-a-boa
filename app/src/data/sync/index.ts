import { useEffect } from 'react';

import { ensureUserId, isRemote } from '../supabaseClient';
import { pullCheckins } from './checkins';
import { pullFavorites } from './favorites';
import { pullFollows } from './follows';
import { pullLive } from './live';
import { useSupport } from '@/state/support';
import { pullTickets } from './support';
import { warn } from './util';

export { pushCheckin, pullCheckins } from './checkins';
export { pushFavorite, pullFavorites } from './favorites';
export { pushFollow, pushUnfollow, pullFollows } from './follows';
export { pushReport, pullLive, useLiveSummary } from './live';

/** Signs in anonymously, then pulls favorites, follows, check-ins, live reports and support tickets once. No-op unless remote. */
export async function syncAll(): Promise<void> {
  if (!isRemote()) return;
  if (!(await ensureUserId())) return;
  const results = await Promise.allSettled([
    pullFavorites(),
    pullFollows(),
    pullCheckins(),
    pullLive(),
    pullTickets().then((list) => useSupport.getState().mergeRemote(list)),
  ]);
  for (const r of results) if (r.status === 'rejected') warn('syncAll', r.reason);
}

/** Mount once in the root layout. */
export function useRemoteSync(): void {
  useEffect(() => {
    void syncAll();
  }, []);
}

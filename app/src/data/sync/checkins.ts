import type { CheckinPosition } from '@/domain/checkin';
import type { Checkin } from '@/domain/engage';
import { useCheckins } from '@/state/checkins';

import { authedClient, isDuplicate, isRejection, safely, warn, whenHydrated, type PushResult } from './util';

const setUnsynced = (eventId: string, on: boolean) =>
  useCheckins.setState((s) => {
    const has = s.unsynced.includes(eventId);
    if (on === has) return s;
    return { unsynced: on ? [...s.unsynced, eventId] : s.unsynced.filter((x) => x !== eventId) };
  });

/**
 * Checks in through public.check_in(): the server stamps `at` and enforces the window (2h before start until the end)
 * and the distance to the venue. The position is sent only for that check and never stored. Without a position (a
 * check-in left over from before 0018, or made offline) the server refuses. A rejection keeps the local row and marks
 * it unsynced; it is not retried.
 */
export function pushCheckin(eventId: string, pos?: CheckinPosition): Promise<PushResult> {
  return safely('checkin', async (sb) => {
    const { error } = await sb.rpc('check_in', {
      p_event_id: eventId,
      p_lat: pos?.lat ?? null,
      p_lng: pos?.lng ?? null,
      p_accuracy_m: pos?.accuracyM ?? null,
    });
    if (error && !isDuplicate(error)) {
      if (isRejection(error)) {
        setUnsynced(eventId, true);
        return 'rejected';
      }
      throw error;
    }
    setUnsynced(eventId, false);
    return 'synced';
  });
}

/** Server wins for events it has (including its `at`); local-only rows are kept and returned for upload. */
export function mergeCheckins(local: Checkin[], server: Checkin[]) {
  const ids = new Set(server.map((c) => c.eventId));
  const localOnly = local.filter((c) => !ids.has(c.eventId));
  return { merged: [...server, ...localOnly], localOnly };
}

export async function pullCheckins(): Promise<void> {
  try {
    const sb = await authedClient();
    if (!sb) return;
    const { data, error } = await sb.from('checkins').select('event_id, at');
    if (error) throw error;
    const server = ((data ?? []) as { event_id: string; at: string }[]).map((r) => ({ eventId: r.event_id, at: r.at }));
    await whenHydrated(useCheckins);
    const state = useCheckins.getState();
    const { merged, localOnly } = mergeCheckins(state.checkins, server);
    const onServer = new Set(server.map((c) => c.eventId));
    useCheckins.setState({ checkins: merged, unsynced: state.unsynced.filter((id) => !onServer.has(id)) });
    // Rows the server already rejected stay unsynced and are not retried.
    await Promise.all(localOnly.filter((c) => !state.unsynced.includes(c.eventId)).map((c) => pushCheckin(c.eventId)));
  } catch (e) {
    warn('pullCheckins', e);
  }
}

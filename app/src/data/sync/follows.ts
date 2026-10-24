import type { AlertKind, EventFollow } from '@/domain/engage';
import { defaultAlerts, defaultChannels, useFollows } from '@/state/follows';

import { authedClient, safely, warn, whenHydrated, type PushResult } from './util';

export interface FollowRow {
  event_id: string;
  followed_at: string;
  has_ticket: boolean;
  alerts: Partial<Record<AlertKind, boolean>> | null;
  channels: Partial<Record<'push' | 'email', boolean>> | null;
}

export const toRow = (f: EventFollow) => ({
  event_id: f.eventId,
  followed_at: f.followedAt,
  has_ticket: f.hasTicket,
  alerts: f.alerts,
  channels: f.channels,
});

export const fromRow = (r: FollowRow): EventFollow => ({
  eventId: r.event_id,
  followedAt: r.followed_at,
  hasTicket: !!r.has_ticket,
  alerts: { ...defaultAlerts(), ...(r.alerts ?? {}) },
  channels: { ...defaultChannels(), ...(r.channels ?? {}) },
});

/** Upserts a follow with its alert prefs (also used for pref edits). */
export function pushFollow(f: EventFollow | undefined): Promise<PushResult> {
  if (!f) return Promise.resolve('skipped');
  return safely('follow', async (sb) => {
    const { error } = await sb.from('event_follows').upsert(toRow(f), { onConflict: 'user_id,event_id' });
    if (error) throw error;
    return 'synced';
  });
}

export function pushUnfollow(eventId: string): Promise<PushResult> {
  return safely('unfollow', async (sb) => {
    const { error } = await sb.from('event_follows').delete().eq('event_id', eventId);
    if (error) throw error;
    return 'synced';
  });
}

/** Server wins for events it has; local-only follows are kept and returned for upload. */
export function mergeFollows(local: Record<string, EventFollow>, server: EventFollow[]) {
  const merged: Record<string, EventFollow> = { ...local };
  for (const f of server) merged[f.eventId] = f;
  const serverIds = new Set(server.map((f) => f.eventId));
  const localOnly = Object.values(local).filter((f) => !serverIds.has(f.eventId));
  return { merged, localOnly };
}

export async function pullFollows(): Promise<void> {
  try {
    const sb = await authedClient();
    if (!sb) return;
    const { data, error } = await sb.from('event_follows').select('event_id, followed_at, has_ticket, alerts, channels');
    if (error) throw error;
    await whenHydrated(useFollows);
    const { merged, localOnly } = mergeFollows(useFollows.getState().follows, ((data ?? []) as FollowRow[]).map(fromRow));
    useFollows.setState({ follows: merged });
    await Promise.all(localOnly.map((f) => pushFollow(f)));
  } catch (e) {
    warn('pullFollows', e);
  }
}

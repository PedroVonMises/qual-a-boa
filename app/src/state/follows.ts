import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { AlertChannel, AlertKind, EventChange, EventFollow } from '@/domain/engage';

export const ALERT_KINDS: AlertKind[] = ['lineup', 'price', 'lastTickets', 'dayBefore', 'cancelled'];
export const MAX_CHANGES = 100;

export interface FollowsData {
  follows: Record<string, EventFollow>;
  changes: EventChange[];
}

export const emptyFollows: FollowsData = { follows: {}, changes: [] };

export const defaultAlerts = (): Record<AlertKind, boolean> => ({
  lineup: true,
  price: true,
  lastTickets: true,
  dayBefore: true,
  cancelled: true,
});
export const defaultChannels = (): Record<AlertChannel, boolean> => ({ push: true, email: false });

// --- Pure reducers (state in, new state out) ---

export function followEvent(d: FollowsData, eventId: string, nowIso: string): FollowsData {
  if (d.follows[eventId]) return d;
  const f: EventFollow = { eventId, followedAt: nowIso, hasTicket: false, alerts: defaultAlerts(), channels: defaultChannels() };
  return { ...d, follows: { ...d.follows, [eventId]: f } };
}

export function unfollowEvent(d: FollowsData, eventId: string): FollowsData {
  if (!d.follows[eventId]) return d;
  const follows = { ...d.follows };
  delete follows[eventId];
  return { follows, changes: d.changes.filter((c) => c.eventId !== eventId) };
}

function patch(d: FollowsData, eventId: string, fn: (f: EventFollow) => EventFollow): FollowsData {
  const f = d.follows[eventId];
  return f ? { ...d, follows: { ...d.follows, [eventId]: fn(f) } } : d;
}

export const setAlert = (d: FollowsData, eventId: string, kind: AlertKind, on: boolean) =>
  patch(d, eventId, (f) => ({ ...f, alerts: { ...f.alerts, [kind]: on } }));

export const setChannel = (d: FollowsData, eventId: string, channel: AlertChannel, on: boolean) =>
  patch(d, eventId, (f) => ({ ...f, channels: { ...f.channels, [channel]: on } }));

export const setHasTicket = (d: FollowsData, eventId: string, hasTicket: boolean) =>
  patch(d, eventId, (f) => ({ ...f, hasTicket }));

/** Adds changes for followed events only, de-duplicated by id, newest first, capped. */
export function addChanges(d: FollowsData, list: EventChange[]): FollowsData {
  const known = new Set(d.changes.map((c) => c.id));
  const fresh = list.filter((c) => !known.has(c.id) && d.follows[c.eventId]);
  if (!fresh.length) return d;
  const changes = [...d.changes, ...fresh].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, MAX_CHANGES);
  return { ...d, changes };
}

export const markRead = (d: FollowsData, id: string): FollowsData => ({
  ...d,
  changes: d.changes.map((c) => (c.id === id && !c.read ? { ...c, read: true } : c)),
});

export const markAllRead = (d: FollowsData, eventId?: string): FollowsData => ({
  ...d,
  changes: d.changes.map((c) => (!c.read && (!eventId || c.eventId === eventId) ? { ...c, read: true } : c)),
});

export const unreadCount = (d: FollowsData, eventId?: string) =>
  d.changes.filter((c) => !c.read && (!eventId || c.eventId === eventId)).length;

// --- Store ---

interface FollowsStore extends FollowsData {
  follow: (eventId: string, nowIso?: string) => void;
  unfollow: (eventId: string) => void;
  setAlert: (eventId: string, kind: AlertKind, on: boolean) => void;
  setChannel: (eventId: string, channel: AlertChannel, on: boolean) => void;
  setHasTicket: (eventId: string, hasTicket: boolean) => void;
  addChanges: (list: EventChange[]) => void;
  markRead: (id: string) => void;
  markAllRead: (eventId?: string) => void;
  isFollowing: (eventId: string) => boolean;
}

export const useFollows = create<FollowsStore>()(
  persist(
    (set, get) => ({
      ...emptyFollows,
      follow: (eventId, nowIso = new Date().toISOString()) => set((s) => followEvent(s, eventId, nowIso)),
      unfollow: (eventId) => set((s) => unfollowEvent(s, eventId)),
      setAlert: (eventId, kind, on) => set((s) => setAlert(s, eventId, kind, on)),
      setChannel: (eventId, channel, on) => set((s) => setChannel(s, eventId, channel, on)),
      setHasTicket: (eventId, v) => set((s) => setHasTicket(s, eventId, v)),
      addChanges: (list) => set((s) => addChanges(s, list)),
      markRead: (id) => set((s) => markRead(s, id)),
      markAllRead: (eventId) => set((s) => markAllRead(s, eventId)),
      isFollowing: (eventId) => !!get().follows[eventId],
    }),
    {
      name: 'qab.follows',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ follows: s.follows, changes: s.changes }),
    },
  ),
);

import { useEffect, useMemo } from 'react';

import { isRemote } from '@/data/supabaseClient';
import { isServerId, useRemoteComments, useRemoteThreads, type RemoteThread } from '@/data/sync/community';
import { topHelpful, type Comment, type Thread } from '@/domain/community';
import { flushCommunity, useCommunity } from '@/state/community';
import { DEMO_COMMENTS, DEMO_THREADS } from './demo';

export interface ThreadView extends Thread {
  /** Replies shown on the card: server/demo count plus comments written on this device and not yet synced. */
  replies: number;
  top?: { body: string; votes: number };
  /** `agora` thread of an event that ended: kept in the event hub, hidden from the feed. */
  archived?: boolean;
}

const byNewest = (a: { createdAt: string }, b: { createdAt: string }) => (a.createdAt < b.createdAt ? 1 : -1);

/**
 * All threads, newest first, with reply counts and the pinned Mais útil preview resolved.
 * Backend off: this device's threads + the pilot demo threads. Backend on: server threads, with this device's
 * unsynced threads on top (the server row wins once a thread has synced); no demo content.
 */
export function useThreads(): ThreadView[] {
  const remote = isRemote();
  const mineThreads = useCommunity((s) => s.threads);
  const mineComments = useCommunity((s) => s.comments);
  const votedIds = useCommunity((s) => s.votedIds);
  const tick = useCommunity((s) => s.tick);
  const q = useRemoteThreads(tick);

  // Retry anything left unsynced whenever the feed is (re)loaded.
  useEffect(() => {
    if (remote) void flushCommunity();
  }, [remote]);

  return useMemo(() => {
    if (remote) {
      const server = new Map<string, RemoteThread>((q.data ?? []).map((t) => [t.id, t]));
      const local = mineThreads.filter((t) => !server.has(t.id));
      const views: ThreadView[] = [
        ...local.map((t) => ({
          ...t,
          replies: mineComments.filter((c) => c.threadId === t.id).length,
        })),
        ...[...server.values()].map((t) => ({
          ...t,
          replies: t.replies + mineComments.filter((c) => c.threadId === t.id && !isServerId(c.id)).length,
        })),
      ];
      return views.sort(byNewest);
    }
    const all = [...mineThreads, ...DEMO_THREADS];
    const comments = [...DEMO_COMMENTS, ...mineComments];
    return all
      .map((t) => {
        const own = mineComments.filter((c) => c.threadId === t.id).length;
        const top = topHelpful(
          comments.filter((c) => c.threadId === t.id && !c.parentId),
          votedIds,
        );
        return {
          ...t,
          replies: t.commentCount + own,
          top: top ? { body: top.body, votes: top.helpfulCount + (votedIds.includes(top.id) ? 1 : 0) } : undefined,
        };
      })
      .sort(byNewest);
  }, [remote, q.data, mineThreads, mineComments, votedIds]);
}

export function useThread(id: string | undefined): ThreadView | undefined {
  const threads = useThreads();
  return useMemo(() => threads.find((t) => t.id === id), [threads, id]);
}

/** Comments of a thread. Backend on: server comments plus this device's unsynced ones; off: demo + this device's. */
export function useComments(threadId: string | undefined): Comment[] {
  const remote = isRemote();
  const mine = useCommunity((s) => s.comments);
  const tick = useCommunity((s) => s.tick);
  const adoptVotes = useCommunity((s) => s.adoptVotes);
  const q = useRemoteComments(threadId, tick);

  useEffect(() => {
    const voted = (q.data ?? []).filter((c) => c.voted).map((c) => c.id);
    if (voted.length) adoptVotes(voted);
  }, [q.data, adoptVotes]);

  return useMemo(() => {
    const here = mine.filter((c) => c.threadId === threadId);
    if (remote) {
      const server = q.data ?? [];
      const known = new Set(server.map((c) => c.id));
      return [...server, ...here.filter((c) => !known.has(c.id))];
    }
    return [...DEMO_COMMENTS.filter((c) => c.threadId === threadId), ...here];
  }, [remote, q.data, mine, threadId]);
}

/** Threads that belong to an event: written for it, or pinned to its venue (pilot demo). */
export function threadsForEvent(threads: ThreadView[], eventId: string, venueSlug?: string): ThreadView[] {
  return threads.filter((t) => t.eventId === eventId || (!!venueSlug && t.venueSlug === venueSlug && !t.eventId));
}

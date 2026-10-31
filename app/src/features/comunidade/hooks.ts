import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { isRemote } from '@/data/supabaseClient';
import {
  isServerId,
  refreshFirstPage,
  useRefreshOnPush,
  useRemoteComments,
  useRemoteThread,
  useThreadsInfinite,
  type RemoteThread,
} from '@/data/sync/community';
import {
  COMMUNITY_PAGE_SIZE,
  threadMatchesQuery,
  threadQueryKey,
  topHelpful,
  type Comment,
  type Thread,
  type ThreadQuery,
} from '@/domain/community';
import { env } from '@/lib/env';
import { flushCommunity, useCommunity } from '@/state/community';
import { DEMO_COMMENTS, DEMO_THREADS, syntheticThreads } from './demo';

export interface ThreadView extends Thread {
  /** Replies shown on the card: server/demo count plus comments written on this device and not yet synced. */
  replies: number;
  top?: { body: string; votes: number };
  /** `agora` thread of an event that ended: kept on the event page, hidden from the feed. */
  archived?: boolean;
}

export interface ThreadFeed {
  items: ThreadView[];
  /** First load (nothing to show yet). A filter change keeps the previous list and is not "loading". */
  isLoading: boolean;
  isError: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  /** The last "next page" request failed: show an inline retry, keep the list. */
  isFetchNextPageError: boolean;
  fetchNextPage: () => void;
  /** Pull-to-refresh: back to page 1. */
  refresh: () => Promise<void>;
}

const newestFirst = (a: { createdAt: string; id: string }, b: { createdAt: string; id: string }) =>
  a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : a.id < b.id ? 1 : -1;

/** A local/demo thread with its reply count and the pinned Mais útil preview resolved from its comments. */
function toView(t: Thread, comments: Comment[], votedIds: string[]): ThreadView {
  const mine = comments.filter((c) => c.threadId === t.id);
  const top = topHelpful(
    mine.filter((c) => !c.parentId),
    votedIds,
  );
  return {
    ...t,
    replies: t.commentCount + mine.filter((c) => c.mine).length,
    top: top ? { body: top.body, votes: top.helpfulCount + (votedIds.includes(top.id) ? 1 : 0) } : undefined,
  };
}

const byHelpful = (a: ThreadView, b: ThreadView) => (b.top?.votes ?? 0) - (a.top?.votes ?? 0) || newestFirst(a, b);

/** Dev-only synthetic threads (seed mode); empty in production and when not requested. */
function useSyntheticThreads(): Thread[] {
  return useMemo(() => (isRemote() ? [] : syntheticThreads(env.demoThreads)), []);
}

/**
 * A page-by-page list of threads (feed or one event's page) with filters applied server-side.
 * Backend on: `useInfiniteQuery` over `threads_feed` (keyset paging); this device's unsynced threads sit on top.
 * Backend off: this device's threads + the pilot demo threads, paged client-side with the same shape, so the screens
 * do not care where rows come from.
 * Nothing is inserted above what the user is looking at: the list only refreshes after their own push, on
 * pull-to-refresh, or when the screen mounts.
 */
export function useThreads(q: ThreadQuery): ThreadFeed {
  const remote = isRemote();
  const client = useQueryClient();
  const mineThreads = useCommunity((s) => s.threads);
  const mineComments = useCommunity((s) => s.comments);
  const votedIds = useCommunity((s) => s.votedIds);
  const tick = useCommunity((s) => s.tick);
  const synthetic = useSyntheticThreads();
  const inf = useThreadsInfinite(q);
  useRefreshOnPush(q, tick);

  // Retry anything left unsynced whenever a feed is (re)loaded.
  useEffect(() => {
    if (remote) void flushCommunity();
  }, [remote]);

  // Local mode pages client-side; it restarts from page 1 whenever the query changes.
  const keyText = threadQueryKey(q).join('/');
  const [visible, setVisible] = useState(COMMUNITY_PAGE_SIZE);
  useEffect(() => setVisible(COMMUNITY_PAGE_SIZE), [keyText]);

  const remoteItems = useMemo<ThreadView[]>(() => {
    if (!remote) return [];
    const seen = new Set<string>();
    const server: RemoteThread[] = [];
    for (const page of inf.data?.pages ?? []) {
      for (const t of page.items) {
        if (seen.has(t.id)) continue; // helpful sort pages by offset: votes can move a row across a boundary
        seen.add(t.id);
        server.push(t);
      }
    }
    const newest = server.reduce((m, t) => (t.createdAt > m ? t.createdAt : m), '');
    const overlay = mineThreads.filter(
      (t) => !seen.has(t.id) && (!isServerId(t.id) || t.createdAt > newest) && threadMatchesQuery(t, q),
    );
    const unsynced = (id: string) => mineComments.filter((c) => c.threadId === id && !isServerId(c.id)).length;
    return [
      ...overlay.sort(newestFirst).map((t) => ({ ...t, replies: t.commentCount + unsynced(t.id) })),
      ...server.map((t) => ({ ...t, replies: t.replies + unsynced(t.id) })),
    ];
    // `q` is derived from stable inputs by the caller; the key text covers it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remote, inf.data, mineThreads, mineComments, keyText]);

  const localAll = useMemo<ThreadView[]>(() => {
    if (remote) return [];
    const comments = [...DEMO_COMMENTS, ...mineComments];
    const all = [...mineThreads, ...DEMO_THREADS, ...synthetic]
      .filter((t) => threadMatchesQuery(t, q))
      .map((t) => toView(t, comments, votedIds));
    return all.sort(q.sort === 'helpful' ? byHelpful : newestFirst);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remote, mineThreads, mineComments, votedIds, synthetic, keyText]);

  if (!remote) {
    return {
      items: localAll.slice(0, visible),
      isLoading: false,
      isError: false,
      hasNextPage: visible < localAll.length,
      isFetchingNextPage: false,
      isFetchNextPageError: false,
      fetchNextPage: () => setVisible((v) => v + COMMUNITY_PAGE_SIZE),
      refresh: async () => setVisible(COMMUNITY_PAGE_SIZE),
    };
  }

  return {
    items: remoteItems,
    isLoading: inf.isPending && inf.fetchStatus !== 'idle',
    isError: inf.isError && remoteItems.length === 0,
    hasNextPage: !!inf.hasNextPage,
    isFetchingNextPage: inf.isFetchingNextPage,
    isFetchNextPageError: inf.isFetchNextPageError,
    fetchNextPage: () => {
      if (inf.hasNextPage && !inf.isFetchingNextPage) void inf.fetchNextPage();
    },
    // Nothing loaded yet (a failed first load): a plain refetch. Otherwise back to page 1.
    refresh: () =>
      inf.data
        ? refreshFirstPage(client, q, { reset: true }).catch(() => undefined)
        : inf.refetch().then(() => undefined),
  };
}

/**
 * A thread by id, without touching the feed: this device's threads and demo content first (a local id resolves through
 * its alias once synced), then the server row. A deep link therefore never loads a feed page.
 */
export function useThread(id: string | undefined): ThreadView | undefined {
  const remote = isRemote();
  const real = useCommunity((s) => (id ? (s.aliases[id] ?? id) : id));
  const tick = useCommunity((s) => s.tick);
  const mineThreads = useCommunity((s) => s.threads);
  const mineComments = useCommunity((s) => s.comments);
  const votedIds = useCommunity((s) => s.votedIds);
  const synthetic = useSyntheticThreads();
  const single = useRemoteThread(real, tick);

  return useMemo(() => {
    const unsynced = (tid: string) => mineComments.filter((c) => c.threadId === tid && !isServerId(c.id)).length;
    if (remote && single.data) return { ...single.data, replies: single.data.replies + unsynced(single.data.id) };
    const local =
      mineThreads.find((t) => t.id === real) ??
      (remote ? undefined : [...DEMO_THREADS, ...synthetic].find((t) => t.id === real));
    return local ? toView(local, [...DEMO_COMMENTS, ...mineComments], votedIds) : undefined;
  }, [remote, single.data, mineThreads, mineComments, votedIds, synthetic, real]);
}

/** Comments of a thread. Backend on: server comments plus this device's unsynced ones; off: demo + this device's. */
export function useComments(threadId: string | undefined): Comment[] {
  const remote = isRemote();
  const aliased = useCommunity((s) => (threadId ? (s.aliases[threadId] ?? threadId) : threadId));
  const mine = useCommunity((s) => s.comments);
  const tick = useCommunity((s) => s.tick);
  const adoptVotes = useCommunity((s) => s.adoptVotes);
  const q = useRemoteComments(aliased, tick);

  useEffect(() => {
    const voted = (q.data ?? []).filter((c) => c.voted).map((c) => c.id);
    if (voted.length) adoptVotes(voted);
  }, [q.data, adoptVotes]);

  return useMemo(() => {
    const here = mine.filter((c) => c.threadId === aliased);
    if (remote) {
      const server = q.data ?? [];
      const known = new Set(server.map((c) => c.id));
      return [...server, ...here.filter((c) => !known.has(c.id))];
    }
    return [...DEMO_COMMENTS.filter((c) => c.threadId === aliased), ...here];
  }, [remote, q.data, mine, aliased]);
}

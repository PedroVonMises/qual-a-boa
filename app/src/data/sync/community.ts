import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import {
  COMMUNITY_PAGE_SIZE,
  MAX_FOLLOWED_IN_QUERY,
  decodeKeyset,
  decodeOffset,
  encodeKeyset,
  threadQueryKey,
  type Comment,
  type Thread,
  type ThreadKind,
  type ThreadPage,
  type ThreadQuery,
} from '@/domain/community';
import type { Uf } from '@/domain/region';

import type { SupabaseClient } from '@supabase/supabase-js';

import { ensureUserId, getSupabase, isRemote } from '../supabaseClient';
import { UUID_RE } from './reviews';
import { authedClient, isDuplicate, warn } from './util';

/** Row of the `threads_feed` view. */
export interface ThreadFeedRow {
  id: string;
  event_id: string | null;
  venue_id: string | null;
  event_name: string | null;
  venue_slug: string | null;
  kind: ThreadKind;
  title: string;
  body: string | null;
  anonymous: boolean;
  handle: string | null;
  avatar_hue: number | null;
  status: 'published' | 'hidden';
  comment_count: number;
  created_at: string;
  mine: boolean;
  archived: boolean;
  top_comment_id: string | null;
  top_comment_body: string | null;
  top_comment_votes: number | null;
  uf: string;
}

/** Row of the `comments_feed` view. */
export interface CommentFeedRow {
  id: string;
  thread_id: string;
  parent_id: string | null;
  body: string;
  anonymous: boolean;
  handle: string | null;
  avatar_hue: number | null;
  status: 'published' | 'hidden';
  helpful_count: number;
  created_at: string;
  mine: boolean;
  voted: boolean;
}

export interface RemoteThread extends Thread {
  /** Published replies (server count). */
  replies: number;
  /** Pinned "Mais útil" reply: only present from 3 votes (decided by the view). */
  top?: { body: string; votes: number };
  archived: boolean;
}

export interface RemoteComment extends Comment {
  /** The caller already voted (server truth). `helpfulCount` then excludes that vote, like local comments. */
  voted: boolean;
}

const author = (r: { anonymous: boolean; handle: string | null; avatar_hue: number | null }) =>
  r.anonymous || !r.handle
    ? { anonymous: true as const }
    : { anonymous: false as const, handle: r.handle, avatarHue: r.avatar_hue ?? undefined };

export function mapThreadRow(r: ThreadFeedRow): RemoteThread {
  return {
    id: r.id,
    eventId: r.event_id ?? undefined,
    venueSlug: r.venue_slug ?? undefined,
    eventName: r.event_name ?? 'Evento',
    kind: r.kind,
    title: r.title,
    body: r.body ?? undefined,
    uf: r.uf as Uf,
    author: author(r),
    createdAt: r.created_at,
    commentCount: r.comment_count,
    helpfulCount: 0,
    mine: r.mine,
    replies: r.comment_count,
    archived: r.archived,
    top:
      r.top_comment_id && r.top_comment_body != null
        ? { body: r.top_comment_body, votes: r.top_comment_votes ?? 0 }
        : undefined,
  };
}

export function mapCommentRow(r: CommentFeedRow): RemoteComment {
  return {
    id: r.id,
    threadId: r.thread_id,
    parentId: r.parent_id ?? undefined,
    author: author(r),
    body: r.body,
    createdAt: r.created_at,
    // The UI adds the viewer's own vote on top, so the stored base must not already contain it.
    helpfulCount: Math.max(r.helpful_count - (r.voted ? 1 : 0), 0),
    mine: r.mine,
    voted: r.voted,
  };
}

export const isServerId = (id: string | undefined): id is string => !!id && UUID_RE.test(id);

const EMPTY_PAGE: ThreadPage<RemoteThread> = { items: [], nextCursor: null };

/**
 * One page of `threads_feed` (published threads + the caller's own). Fetches PAGE_SIZE + 1 rows so "is there a next
 * page" needs no count query. Recency pages with a keyset cursor (`created_at|id`): a thread posted meanwhile cannot
 * duplicate or skip a row. The helpful sort (event page) uses an offset cursor over the pinned reply's votes.
 * Filters run on the server, so every page is full. Throws on network/RLS errors.
 */
export async function pullThreadsPage(q: ThreadQuery, cursor: string | null = null): Promise<ThreadPage<RemoteThread>> {
  const sb = getSupabase();
  if (!sb) return EMPTY_PAGE;
  if (q.eventId !== undefined && !isServerId(q.eventId)) return EMPTY_PAGE;
  const followed = (q.followedEventIds ?? []).filter(isServerId).slice(0, MAX_FOLLOWED_IN_QUERY);
  if (q.scope === 'following' && followed.length === 0) return EMPTY_PAGE;

  const n = COMMUNITY_PAGE_SIZE;
  let f = sb.from('threads_feed').select('*');
  if (q.eventId) f = f.eq('event_id', q.eventId);
  if (q.uf) f = f.eq('uf', q.uf);
  if (q.kind) f = f.eq('kind', q.kind);
  if (q.scope === 'tonight') f = f.eq('kind', 'agora');
  if (q.scope === 'following') f = f.in('event_id', followed);
  if (!q.includeArchived) f = f.eq('archived', false);

  const helpful = q.sort === 'helpful';
  const offset = helpful ? decodeOffset(cursor) : 0;
  if (!helpful) {
    const k = decodeKeyset(cursor);
    if (k) f = f.or(`created_at.lt.${k.createdAt},and(created_at.eq.${k.createdAt},id.lt.${k.id})`);
  }
  const ordered = helpful
    ? f
        .order('top_comment_votes', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + n)
    : f.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(n + 1);

  const { data, error } = await ordered;
  if (error) throw error;
  const rows = (data ?? []) as ThreadFeedRow[];
  const page = rows.slice(0, n);
  const last = page[page.length - 1];
  const more = rows.length > n && !!last;
  return {
    items: page.map(mapThreadRow),
    nextCursor: more ? (helpful ? String(offset + n) : encodeKeyset({ createdAt: last.created_at, id: last.id })) : null,
  };
}

/** One thread by id (deep links and threads older than the feed window). Null when missing or hidden from the caller. */
export async function pullThread(id: string): Promise<RemoteThread | null> {
  const sb = getSupabase();
  if (!sb || !isServerId(id)) return null;
  const { data, error } = await sb.from('threads_feed').select('*').eq('id', id).limit(1);
  if (error) throw error;
  const row = ((data ?? []) as ThreadFeedRow[])[0];
  return row ? mapThreadRow(row) : null;
}

/** Comments of a thread, oldest first. Throws on network/RLS errors. */
export async function pullComments(threadId: string): Promise<RemoteComment[]> {
  const sb = getSupabase();
  if (!sb || !isServerId(threadId)) return [];
  const { data, error } = await sb
    .from('comments_feed')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as CommentFeedRow[]).map(mapCommentRow);
}

/** Signed-in client + user id for writes, or null when not remote / not signed in (callers stay local-only). */
async function writer(): Promise<{ sb: SupabaseClient; uid: string } | null> {
  const sb = await authedClient();
  const uid = sb ? await ensureUserId() : null;
  return sb && uid ? { sb, uid } : null;
}

export interface Profile {
  handle: string;
  avatarHue: number;
}

export type HandleResult = 'ok' | 'taken' | 'failed';

/** Claims `handle` on the caller's profile (insert or update). 'taken' = another user owns it. Never throws. */
export async function pushHandle(profile: Profile): Promise<HandleResult> {
  try {
    const w = await writer();
    if (!w) return 'failed';
    const { sb, uid } = w;
    const { error } = await sb
      .from('profiles')
      .upsert({ id: uid, handle: profile.handle, avatar_hue: profile.avatarHue }, { onConflict: 'id' });
    if (!error) return 'ok';
    if (isDuplicate(error)) return 'taken';
    warn('community handle', error);
    return 'failed';
  } catch (e) {
    warn('community handle', e);
    return 'failed';
  }
}

/** Inserts a thread (a named one needs the handle claimed first: flushCommunity does that once per run). Returns the server id, or null (not remote, not signed in, local id scope, or rejected). Never throws. */
export async function pushThread(thread: Thread): Promise<string | null> {
  try {
    if (!isServerId(thread.eventId)) return null;
    const w = await writer();
    if (!w) return null;
    const { sb, uid } = w;
    const { data, error } = await sb
      .from('threads')
      .insert({
        event_id: thread.eventId,
        user_id: uid,
        kind: thread.kind,
        title: thread.title,
        body: thread.body ?? null,
        anonymous: thread.author.anonymous,
      })
      .select('id')
      .single();
    if (error) {
      warn('community thread', error);
      return null;
    }
    return (data as { id: string }).id;
  } catch (e) {
    warn('community thread', e);
    return null;
  }
}

/** Inserts a comment; needs server ids for the thread and parent. Returns the server id or null. Never throws. */
export async function pushComment(comment: Comment): Promise<string | null> {
  try {
    if (!isServerId(comment.threadId) || (comment.parentId && !isServerId(comment.parentId))) return null;
    const w = await writer();
    if (!w) return null;
    const { sb, uid } = w;
    const { data, error } = await sb
      .from('comments')
      .insert({
        thread_id: comment.threadId,
        parent_id: comment.parentId ?? null,
        user_id: uid,
        body: comment.body,
        anonymous: comment.author.anonymous,
      })
      .select('id')
      .single();
    if (error) {
      warn('community comment', error);
      return null;
    }
    return (data as { id: string }).id;
  } catch (e) {
    warn('community comment', e);
    return null;
  }
}

/** Adds or removes the caller's "Útil" on a comment. True on success. */
export async function pushCommentVote(commentId: string, on: boolean): Promise<boolean> {
  try {
    if (!isServerId(commentId)) return false;
    const w = await writer();
    if (!w) return false;
    const { sb, uid } = w;
    const res = on
      ? await sb.from('comment_votes').insert({ comment_id: commentId, user_id: uid })
      : await sb.from('comment_votes').delete().eq('comment_id', commentId).eq('user_id', uid);
    // 23505: the vote is already there, which is the state we wanted.
    if (res.error && !isDuplicate(res.error)) {
      warn('community vote', res.error);
      return false;
    }
    return true;
  } catch (e) {
    warn('community vote', e);
    return false;
  }
}

export const DEFAULT_REPORT_REASON = 'Denunciado pelo usuário';
export type ReportTarget = { threadId: string } | { commentId: string };

/** Denunciar. True only when the server accepted (or already had) the report. */
export async function pushCommunityReport(target: ReportTarget, reason: string = DEFAULT_REPORT_REASON): Promise<boolean> {
  try {
    const id = 'threadId' in target ? target.threadId : target.commentId;
    if (!isServerId(id)) return false;
    const w = await writer();
    if (!w) return false;
    const { sb, uid } = w;
    const { error } = await sb.from('community_reports').insert({
      user_id: uid,
      thread_id: 'threadId' in target ? target.threadId : null,
      comment_id: 'commentId' in target ? target.commentId : null,
      reason: reason.slice(0, 500) || DEFAULT_REPORT_REASON,
    });
    if (error && !isDuplicate(error)) {
      warn('community report', error);
      return false;
    }
    return true;
  } catch (e) {
    warn('community report', e);
    return false;
  }
}

/** Calls `refetch` when `version` changes (after the first render), keeping the data on screen meanwhile. */
function useRefetchOnChange(version: number, refetch: () => unknown) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    void refetch();
  }, [version, refetch]);
}

export const threadsQueryKey = (q: ThreadQuery) => ['remote', 'community', 'threads', ...threadQueryKey(q)];

/** Remote feed pages for a query. Keeps the previous list on screen while a filter change loads (no blank flash). */
export function useThreadsInfinite(q: ThreadQuery) {
  return useInfiniteQuery({
    queryKey: threadsQueryKey(q),
    enabled: isRemote() && (q.eventId === undefined || isServerId(q.eventId)),
    queryFn: ({ pageParam }) => pullThreadsPage(q, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    placeholderData: keepPreviousData,
  });
}

/**
 * Re-reads page 1 only. If its boundary is unchanged the later pages stay (they are still contiguous); if new threads
 * pushed the boundary, the later pages would leave a gap, so the list falls back to page 1 (as a pull-to-refresh does).
 * `reset` forces that fallback. No-op when the query was never loaded.
 */
export async function refreshFirstPage(client: QueryClient, q: ThreadQuery, opts: { reset?: boolean } = {}): Promise<void> {
  const key = threadsQueryKey(q);
  if (!client.getQueryData(key)) return;
  const fresh = await pullThreadsPage(q, null);
  client.setQueryData<InfiniteData<ThreadPage<RemoteThread>, string | null>>(key, (cur) => {
    if (!cur) return cur;
    const keepRest = !opts.reset && cur.pages[0] !== undefined && cur.pages[0].nextCursor === fresh.nextCursor;
    return keepRest ? { pages: [fresh, ...cur.pages.slice(1)], pageParams: cur.pageParams } : { pages: [fresh], pageParams: [null] };
  });
}

/** Refreshes page 1 when `version` (the store's push counter) changes after the first render. */
export function useRefreshOnPush(q: ThreadQuery, version: number): void {
  const client = useQueryClient();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (isRemote()) void refreshFirstPage(client, q).catch((e) => warn('community refresh', e));
    // `q` is rebuilt each render; the version bump is the only trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, client]);
}

/** One remote thread by id. */
export function useRemoteThread(id: string | undefined, version: number) {
  const q = useQuery({
    queryKey: ['remote', 'community', 'thread', id ?? ''],
    enabled: isRemote() && isServerId(id),
    queryFn: () => pullThread(id!),
  });
  useRefetchOnChange(version, q.refetch);
  return q;
}

/** Remote comments of a thread. */
export function useRemoteComments(threadId: string | undefined, version: number) {
  const q = useQuery({
    queryKey: ['remote', 'community', 'comments', threadId ?? ''],
    enabled: isRemote() && isServerId(threadId),
    queryFn: () => pullComments(threadId!),
  });
  useRefetchOnChange(version, q.refetch);
  return q;
}

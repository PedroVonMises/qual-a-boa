import { useQuery } from '@tanstack/react-query';

import type { Comment, Thread, ThreadKind } from '@/domain/community';

import type { SupabaseClient } from '@supabase/supabase-js';

import { ensureUserId, getSupabase, isRemote } from '../supabaseClient';
import { UUID_RE } from './reviews';
import { isDuplicate, warn } from './util';

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

/** Published threads + the caller's own, newest first. Throws on network/RLS errors. */
export async function pullThreads(): Promise<RemoteThread[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from('threads_feed').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return ((data ?? []) as ThreadFeedRow[]).map(mapThreadRow);
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
  const sb = getSupabase();
  if (!sb || !isRemote()) return null;
  const uid = await ensureUserId();
  return uid ? { sb, uid } : null;
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

/** Posting by name needs the handle on the server first. Anonymous posts skip it. */
async function ensureHandle(anonymous: boolean, profile: Profile | undefined): Promise<boolean> {
  if (anonymous) return true;
  if (!profile) return false;
  return (await pushHandle(profile)) === 'ok';
}

/** Inserts a thread; returns the server id, or null (not remote, not signed in, local id scope, or rejected). Never throws. */
export async function pushThread(thread: Thread, profile?: Profile): Promise<string | null> {
  try {
    if (!isServerId(thread.eventId)) return null;
    const w = await writer();
    if (!w) return null;
    const { sb, uid } = w;
    if (!(await ensureHandle(thread.author.anonymous, profile))) return null;
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
export async function pushComment(comment: Comment, profile?: Profile): Promise<string | null> {
  try {
    if (!isServerId(comment.threadId) || (comment.parentId && !isServerId(comment.parentId))) return null;
    const w = await writer();
    if (!w) return null;
    const { sb, uid } = w;
    if (!(await ensureHandle(comment.author.anonymous, profile))) return null;
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

/** Remote threads. `version` bumps after each successful push so the feed refetches. */
export function useRemoteThreads(version: number) {
  return useQuery({
    queryKey: ['remote', 'community', 'threads', version],
    enabled: isRemote(),
    queryFn: pullThreads,
  });
}

/** Remote comments of a thread. */
export function useRemoteComments(threadId: string | undefined, version: number) {
  return useQuery({
    queryKey: ['remote', 'community', 'comments', threadId ?? '', version],
    enabled: isRemote() && isServerId(threadId),
    queryFn: () => pullComments(threadId!),
  });
}

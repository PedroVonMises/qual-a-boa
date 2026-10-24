import { useQuery } from '@tanstack/react-query';

import type { Review, ReviewStatus, ReviewTopic } from '@/domain/engage';

import { ensureUserId, getSupabase, isRemote } from '../supabaseClient';

import { useReviews } from '@/state/reviews';

const warn = (what: string, err: unknown) => {
  if (__DEV__) console.warn(`[sync/reviews] ${what} failed`, err);
};

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Row of the `reviews_feed` view. */
export interface ReviewFeedRow {
  id: string;
  event_id: string;
  rating: number;
  topics: Partial<Record<ReviewTopic, number>> | null;
  tags: string[] | null;
  text: string | null;
  anonymous: boolean;
  attended: boolean;
  status: ReviewStatus;
  helpful_count: number;
  created_at: string;
  mine: boolean;
}

type Score = 1 | 2 | 3 | 4 | 5;

export function mapReviewRow(row: ReviewFeedRow): Review {
  return {
    id: row.id,
    eventId: row.event_id,
    rating: row.rating as Score,
    topics: (row.topics ?? {}) as Review['topics'],
    tags: row.tags ?? [],
    text: row.text ?? undefined,
    anonymous: row.anonymous,
    attended: row.attended,
    status: row.status,
    createdAt: row.created_at,
    helpfulCount: row.helpful_count,
    mine: row.mine,
  };
}

/** Edit payload. The server decides `status` (always pending for new rows and for content edits). */
export function reviewPayload(r: Review) {
  return {
    rating: r.rating,
    topics: r.topics,
    tags: r.tags,
    text: r.text ?? null,
    anonymous: r.anonymous,
  };
}

/** Published reviews + the caller's own for an event. Throws on network/RLS errors. */
export async function pullReviews(eventId: string): Promise<Review[]> {
  const sb = getSupabase();
  if (!sb || !UUID_RE.test(eventId)) return [];
  const { data, error } = await sb
    .from('reviews_feed')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as ReviewFeedRow[]).map(mapReviewRow);
}

/**
 * Sends the author's review (insert; on the one-review-per-event conflict it becomes an edit).
 * Returns the server row id, or null when not remote, not signed in, or the server rejected it. Never throws.
 */
export async function pushReview(review: Review): Promise<string | null> {
  try {
    const sb = getSupabase();
    if (!sb || !isRemote() || !UUID_RE.test(review.eventId)) return null;
    const uid = await ensureUserId();
    if (!uid) return null;
    const ins = await sb
      .from('reviews')
      .insert({ event_id: review.eventId, user_id: uid, attended: review.attended, ...reviewPayload(review) })
      .select('id')
      .single();
    if (!ins.error) return (ins.data as { id: string }).id;
    if (ins.error.code !== '23505') {
      warn('insert', ins.error);
      return null;
    }
    // Already reviewed (another session/device): edit it. RLS limits the update to the caller's own row.
    const upd = await sb.from('reviews').update(reviewPayload(review)).eq('event_id', review.eventId).select('id').single();
    if (upd.error) {
      warn('update', upd.error);
      return null;
    }
    return (upd.data as { id: string }).id;
  } catch (e) {
    warn('push', e);
    return null;
  }
}

/** Adds or removes the caller's helpful vote. True on success. */
export async function pushHelpful(reviewId: string, on: boolean): Promise<boolean> {
  try {
    const sb = getSupabase();
    if (!sb || !isRemote() || !UUID_RE.test(reviewId)) return false;
    const uid = await ensureUserId();
    if (!uid) return false;
    const res = on
      ? await sb.from('review_votes').insert({ review_id: reviewId, user_id: uid })
      : await sb.from('review_votes').delete().eq('review_id', reviewId).eq('user_id', uid);
    // 23505: the vote is already there, which is the state we wanted.
    if (res.error && res.error.code !== '23505') {
      warn('vote', res.error);
      return false;
    }
    return true;
  } catch (e) {
    warn('vote', e);
    return false;
  }
}

export const DEFAULT_REPORT_REASON = 'Denunciada pelo usuário';

/** Denunciar. True only when the server accepted (or already had) the report. */
export async function pushReport(reviewId: string, reason: string = DEFAULT_REPORT_REASON): Promise<boolean> {
  try {
    const sb = getSupabase();
    if (!sb || !isRemote() || !UUID_RE.test(reviewId)) return false;
    const uid = await ensureUserId();
    if (!uid) return false;
    const { error } = await sb
      .from('review_reports')
      .insert({ review_id: reviewId, user_id: uid, reason: reason.slice(0, 500) || DEFAULT_REPORT_REASON });
    if (error && error.code !== '23505') {
      warn('report', error);
      return false;
    }
    return true;
  } catch (e) {
    warn('report', e);
    return false;
  }
}

/** Remote reviews for an event; also adopts the author's own server row (status changes) into the local store. */
export function useRemoteReviews(eventId: string | undefined) {
  return useQuery({
    queryKey: ['remote', 'reviews', eventId ?? ''],
    enabled: isRemote() && !!eventId && UUID_RE.test(eventId),
    queryFn: async () => {
      const list = await pullReviews(eventId!);
      useReviews.getState().adoptRemote(eventId!, list);
      return list;
    },
  });
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { safeMerge } from './safeMerge';

import { isRemote } from '@/data/supabaseClient';
import { pushHelpful, pushReport, pushReview } from '@/data/sync/reviews';

import { useCheckins } from '@/state/checkins';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { Review, ReviewTopic } from '@/domain/engage';

export const REVIEW_TEXT_MAX = 800;

type Score = 1 | 2 | 3 | 4 | 5;

export interface ReviewInput {
  eventId: string;
  rating: Score;
  topics?: Partial<Record<ReviewTopic, Score>>;
  tags?: string[];
  text?: string;
  anonymous?: boolean;
}

export type CheckinLookup = (eventId: string) => boolean;

let injected: CheckinLookup | undefined;

/** Override how check-ins are looked up (tests, or the orchestrator when wiring agent I's store). */
export function setCheckinLookup(fn: CheckinLookup | undefined) {
  injected = fn;
}

/** Check-in lookup: the injected function (tests), else the persisted check-ins store. */
export function hasCheckin(eventId: string): boolean {
  if (injected) return injected(eventId);
  return useCheckins.getState().hasCheckedIn(eventId);
}

/** Normalizes user text: trims, collapses 3+ newlines, clamps to the limit. Empty becomes undefined. */
export function cleanText(text: string | undefined): string | undefined {
  const t = (text ?? '').replace(/\n{3,}/g, '\n\n').trim().slice(0, REVIEW_TEXT_MAX);
  return t.length ? t : undefined;
}

/** Returns a pt-BR error message when the text should not be published, else undefined. */
export function validateReviewText(text: string): string | undefined {
  if (text.length > REVIEW_TEXT_MAX) return `O texto passou de ${REVIEW_TEXT_MAX} caracteres.`;
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(text) || /(\d[\s().-]*){9,}/.test(text)) {
    return 'Retire e-mails e telefones do texto. Evite dados pessoais de terceiros.';
  }
  return undefined;
}

interface ReviewsStore {
  /** Reviews written on this device (the author's own). */
  mine: Review[];
  helpfulIds: string[];
  reportedIds: string[];
  /** Event ids whose own review is not on the server yet (offline, signed out or rejected). Empty when not remote. */
  unsynced: string[];
  /** Review ids whose report the server accepted ('Denúncia enviada'); the rest are only saved on this device. */
  reportSentIds: string[];
  submitReview: (input: ReviewInput) => Review;
  toggleHelpful: (id: string) => void;
  report: (id: string) => void;
  isHelpful: (id: string) => boolean;
  isReported: (id: string) => boolean;
  isReportSent: (id: string) => boolean;
  /** Merges the author's own server row for an event (e.g. moderation status) unless a local edit is unsent. */
  adoptRemote: (eventId: string, remote: Review[]) => void;
  mineFor: (eventId: string) => Review | undefined;
}

let seq = 0;
const newId = () => `rv-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export const useReviews = create<ReviewsStore>()(
  persist(
    (set, get) => ({
      mine: [],
      helpfulIds: [],
      reportedIds: [],
      unsynced: [],
      reportSentIds: [],
      submitReview: (input) => {
        const review: Review = {
          id: newId(),
          eventId: input.eventId,
          rating: input.rating,
          topics: input.topics ?? {},
          tags: input.tags ?? [],
          text: cleanText(input.text),
          anonymous: !!input.anonymous,
          attended: hasCheckin(input.eventId),
          status: 'pending', // stays pending until moderation
          createdAt: new Date().toISOString(),
          helpfulCount: 0,
          mine: true,
        };
        // One review per event: editing replaces the previous one (and re-enters moderation).
        set((s) => ({
          mine: [review, ...s.mine.filter((r) => r.eventId !== input.eventId)],
          unsynced: isRemote() && !s.unsynced.includes(review.eventId) ? [...s.unsynced, review.eventId] : s.unsynced,
        }));
        if (isRemote()) void syncReview(review);
        return review;
      },
      toggleHelpful: (id) => {
        const on = !get().helpfulIds.includes(id);
        set((s) => ({ helpfulIds: on ? [...s.helpfulIds, id] : s.helpfulIds.filter((x) => x !== id) }));
        if (isRemote()) void pushHelpful(id, on);
      },
      report: (id) => {
        if (get().reportedIds.includes(id)) return;
        set((s) => ({ reportedIds: [...s.reportedIds, id] }));
        if (!isRemote()) return;
        void pushReport(id).then((ok) => {
          if (ok) set((s) => (s.reportSentIds.includes(id) ? s : { reportSentIds: [...s.reportSentIds, id] }));
        });
      },
      isHelpful: (id) => get().helpfulIds.includes(id),
      isReported: (id) => get().reportedIds.includes(id),
      isReportSent: (id) => get().reportSentIds.includes(id),
      adoptRemote: (eventId, remote) => {
        const row = remote.find((r) => r.mine);
        if (!row || get().unsynced.includes(eventId)) return;
        set((s) => ({ mine: [row, ...s.mine.filter((r) => r.eventId !== eventId)] }));
      },
      mineFor: (eventId) => get().mine.find((r) => r.eventId === eventId),
    }),
    {
      name: 'qab.reviews',
      merge: (persisted, current) => safeMerge(persisted, current),
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        mine: s.mine,
        helpfulIds: s.helpfulIds,
        reportedIds: s.reportedIds,
        unsynced: s.unsynced,
        reportSentIds: s.reportSentIds,
      }),
    },
  ),
);

/**
 * Fire-and-forget push of the author's review. On success the local temp id becomes the server id; on any failure the
 * event stays in `unsynced` (no retry loop: the next edit or resubmit tries again). The server decides the status.
 */
async function syncReview(review: Review): Promise<void> {
  const serverId = await pushReview(review);
  if (!serverId) return;
  useReviews.setState((s) => {
    // Skip when the user edited again meanwhile: that newer submit pushes (and flags) itself.
    if (!s.mine.some((r) => r.id === review.id)) return s;
    return {
      unsynced: s.unsynced.filter((e) => e !== review.eventId),
      mine: s.mine.map((r) => (r.id === review.id ? { ...r, id: serverId } : r)),
    };
  });
}

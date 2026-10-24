import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
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

/**
 * Check-in lookup: the injected function, else `@/state/checkins` if that module exists
 * (loaded lazily so this file works before it lands), else false.
 */
export function hasCheckin(eventId: string): boolean {
  if (injected) return injected(eventId);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@/state/checkins') as Record<string, unknown>;
    if (typeof mod.hasCheckin === 'function') return !!(mod.hasCheckin as CheckinLookup)(eventId);
    const store = mod.useCheckins as { getState?: () => Record<string, unknown> } | undefined;
    const state = store?.getState?.();
    if (state && typeof state.hasCheckin === 'function') return !!(state.hasCheckin as CheckinLookup)(eventId);
    if (state && Array.isArray(state.checkins)) return (state.checkins as { eventId: string }[]).some((c) => c.eventId === eventId);
  } catch {
    // module not present yet
  }
  return false;
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
  submitReview: (input: ReviewInput) => Review;
  toggleHelpful: (id: string) => void;
  report: (id: string) => void;
  isHelpful: (id: string) => boolean;
  isReported: (id: string) => boolean;
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
        set((s) => ({ mine: [review, ...s.mine.filter((r) => r.eventId !== input.eventId)] }));
        return review;
      },
      toggleHelpful: (id) =>
        set((s) => ({ helpfulIds: s.helpfulIds.includes(id) ? s.helpfulIds.filter((x) => x !== id) : [...s.helpfulIds, id] })),
      report: (id) => set((s) => (s.reportedIds.includes(id) ? s : { reportedIds: [...s.reportedIds, id] })),
      isHelpful: (id) => get().helpfulIds.includes(id),
      isReported: (id) => get().reportedIds.includes(id),
      mineFor: (eventId) => get().mine.find((r) => r.eventId === eventId),
    }),
    {
      name: 'qab.reviews',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ mine: s.mine, helpfulIds: s.helpfulIds, reportedIds: s.reportedIds }),
    },
  ),
);

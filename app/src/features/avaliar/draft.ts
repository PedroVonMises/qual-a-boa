import { create } from 'zustand';

import type { ReviewTopic } from '@/domain/engage';
import type { SafetyAnswers } from '@/domain/safetyIndex';

type Score = 1 | 2 | 3 | 4 | 5;

type Seed = Partial<Pick<Draft, 'rating' | 'topics' | 'tags' | 'text' | 'anonymous' | 'safety'>>;

/** In-memory draft shared by the two steps (not persisted: leaving the flow discards it). */
interface Draft {
  eventId: string | null;
  rating: Score | 0;
  topics: Partial<Record<ReviewTopic, Score>>;
  tags: string[];
  text: string;
  anonymous: boolean;
  /** "Foi ao evento" safety questions (S2). */
  safety: SafetyAnswers;
  open: (eventId: string, seed?: Seed) => void;
  setRating: (r: Score) => void;
  setTopic: (t: ReviewTopic, v: Score | undefined) => void;
  toggleTag: (tag: string) => void;
  setText: (t: string) => void;
  setAnonymous: (a: boolean) => void;
  /** Tapping the selected answer again clears it. */
  setSafety: <K extends keyof SafetyAnswers>(k: K, v: SafetyAnswers[K]) => void;
  clear: () => void;
}

const empty = { eventId: null, rating: 0 as Score | 0, topics: {} as Draft['topics'], tags: [] as string[], text: '', anonymous: false, safety: {} as SafetyAnswers };

export const useDraft = create<Draft>()((set) => ({
  ...empty,
  open: (eventId, seed) => set({ ...empty, ...seed, eventId }),
  setRating: (rating) => set({ rating }),
  setTopic: (t, v) =>
    set((s) => {
      const topics = { ...s.topics };
      if (v === undefined) delete topics[t];
      else topics[t] = v;
      return { topics };
    }),
  toggleTag: (tag) => set((s) => ({ tags: s.tags.includes(tag) ? s.tags.filter((x) => x !== tag) : [...s.tags, tag] })),
  setText: (text) => set({ text }),
  setAnonymous: (anonymous) => set({ anonymous }),
  setSafety: (k, v) =>
    set((s) => {
      const safety = { ...s.safety };
      if (v === undefined || safety[k] === v) delete safety[k];
      else safety[k] = v;
      return { safety };
    }),
  clear: () => set({ ...empty }),
}));

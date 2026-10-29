import type { Checkin, EventFollow, Review, ReviewStatus } from '@/domain/engage';

/** Meus eventos tabs. */
export type MeusTab = 'reviews' | 'checkins' | 'follows';

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: 'Em análise',
  published: 'Publicada',
  hidden: 'Removida',
};

const byDateDesc = <T>(date: (x: T) => string) => (a: T, b: T) => Date.parse(date(b)) - Date.parse(date(a));

/** Newest first. Does not mutate the store arrays. */
export const sortReviews = (list: Review[]): Review[] => [...list].sort(byDateDesc((r) => r.createdAt));
export const sortCheckins = (list: Checkin[]): Checkin[] => [...list].sort(byDateDesc((c) => c.at));
export const sortFollows = (follows: Record<string, EventFollow>): EventFollow[] =>
  Object.values(follows).sort(byDateDesc((f) => f.followedAt));

/** Tab label with its count, e.g. "Avaliações · 2". */
export const tabLabel = (name: string, count: number) => `${name} · ${count}`;

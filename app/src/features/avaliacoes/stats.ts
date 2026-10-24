import type { Review, ReviewTopic } from '@/domain/engage';

export interface ReviewStats {
  count: number;
  average: number;
  /** Index 0 = 1 star ... index 4 = 5 stars, as a share 0..1 of the total. */
  distribution: number[];
  counts: number[];
  topics: Partial<Record<ReviewTopic, number>>;
}

/** Aggregates PUBLISHED reviews only; pending and hidden ones never count. */
export function computeStats(reviews: Review[]): ReviewStats {
  const pub = reviews.filter((r) => r.status === 'published');
  const counts = [0, 0, 0, 0, 0];
  const sums: Partial<Record<ReviewTopic, { sum: number; n: number }>> = {};
  let total = 0;
  for (const r of pub) {
    counts[r.rating - 1]++;
    total += r.rating;
    for (const [k, v] of Object.entries(r.topics) as [ReviewTopic, number][]) {
      const s = (sums[k] ??= { sum: 0, n: 0 });
      s.sum += v;
      s.n++;
    }
  }
  const topics: ReviewStats['topics'] = {};
  for (const [k, s] of Object.entries(sums) as [ReviewTopic, { sum: number; n: number }][]) topics[k] = s.sum / s.n;
  return {
    count: pub.length,
    average: pub.length ? total / pub.length : 0,
    distribution: counts.map((c) => (pub.length ? c / pub.length : 0)),
    counts,
    topics,
  };
}

export type ReviewSort = 'recent' | 'helpful' | 'critical';

export function sortReviews(reviews: Review[], sort: ReviewSort, helpful: (r: Review) => number): Review[] {
  const list = sort === 'critical' ? reviews.filter((r) => r.rating <= 2) : [...reviews];
  return list.sort((a, b) => (sort === 'helpful' ? helpful(b) - helpful(a) : Date.parse(b.createdAt) - Date.parse(a.createdAt)));
}

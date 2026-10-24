import { fakeClient, flush, type Handler } from './fakeClient';
import { mapReviewRow, pullReviews, pushReport, pushReview, reviewPayload, type ReviewFeedRow } from './reviews';

import { setCheckinLookup, useReviews } from '@/state/reviews';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

let mockClient: unknown = null;
let mockRemote = true;
jest.mock('../supabaseClient', () => ({
  isRemote: () => mockRemote,
  getSupabase: () => (mockRemote ? mockClient : null),
  ensureUserId: async () => (mockRemote ? 'user-1' : null),
}));

const EV = '11111111-1111-4111-8111-111111111111';
const RV = '22222222-2222-4222-8222-222222222222';

const row: ReviewFeedRow = {
  id: RV,
  event_id: EV,
  rating: 4,
  topics: { musica: 5, fila: 2 },
  tags: ['som'],
  text: null,
  anonymous: true,
  attended: true,
  status: 'published',
  helpful_count: 3,
  created_at: '2026-10-24T10:00:00Z',
  mine: false,
};

function use(handler: Handler) {
  const f = fakeClient(handler);
  mockClient = f.client;
  return f.calls;
}

beforeEach(() => {
  mockRemote = true;
  useReviews.setState({ mine: [], helpfulIds: [], reportedIds: [], unsynced: [], reportSentIds: [] });
  setCheckinLookup(() => false);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('review mapping', () => {
  it('maps feed rows to Review', () => {
    expect(mapReviewRow(row)).toEqual({
      id: RV,
      eventId: EV,
      rating: 4,
      topics: { musica: 5, fila: 2 },
      tags: ['som'],
      text: undefined,
      anonymous: true,
      attended: true,
      status: 'published',
      createdAt: '2026-10-24T10:00:00Z',
      helpfulCount: 3,
      mine: false,
    });
  });

  it('maps a Review to the insert payload without status', () => {
    const p = reviewPayload({ ...mapReviewRow(row), text: 'Bom' });
    expect(p).toEqual({ rating: 4, topics: { musica: 5, fila: 2 }, tags: ['som'], text: 'Bom', anonymous: true });
    expect(p).not.toHaveProperty('status');
  });

  it('pullReviews reads reviews_feed for the event', async () => {
    const calls = use(() => ({ data: [row, { ...row, id: 'x', mine: true }] }));
    const list = await pullReviews(EV);
    expect(list.map((r) => r.mine)).toEqual([false, true]);
    expect(calls[0]).toMatchObject({ table: 'reviews_feed', filters: [['event_id', 'eq', EV]] });
  });
});

describe('review push', () => {
  it('submitReview inserts, replaces the temp id and clears the unsynced flag', async () => {
    const calls = use(() => ({ data: { id: RV } }));
    const r = useReviews.getState().submitReview({ eventId: EV, rating: 5, text: 'Ótimo', tags: ['som'] });
    expect(useReviews.getState().unsynced).toEqual([EV]);
    await flush();
    expect(calls[0]).toMatchObject({ table: 'reviews', op: 'insert' });
    expect(calls[0].payload).toMatchObject({ event_id: EV, rating: 5, text: 'Ótimo', attended: false, anonymous: false });
    expect(calls[0].payload).not.toHaveProperty('status');
    expect(useReviews.getState().mineFor(EV)!.id).toBe(RV);
    expect(r.id).not.toBe(RV);
    expect(useReviews.getState().unsynced).toEqual([]);
  });

  it('a rejected review stays local and flagged unsynced, with no retry', async () => {
    const calls = use(() => ({ error: { code: '23514', message: 'attended review requires a check-in' } }));
    setCheckinLookup(() => true);
    useReviews.getState().submitReview({ eventId: EV, rating: 3 });
    await flush();
    await flush();
    expect(calls).toHaveLength(1);
    expect(useReviews.getState().mineFor(EV)!.status).toBe('pending');
    expect(useReviews.getState().unsynced).toEqual([EV]);
  });

  it('turns the one-review-per-event conflict into an update', async () => {
    const calls = use((c) => (c.op === 'insert' ? { error: { code: '23505', message: 'dup' } } : { data: { id: RV } }));
    await expect(pushReview({ ...mapReviewRow(row), mine: true })).resolves.toBe(RV);
    expect(calls.map((c) => c.op)).toEqual(['insert', 'update']);
    expect(calls[1].filters).toEqual([['event_id', 'eq', EV]]);
  });

  it('helpful vote inserts and removes review_votes for server ids only', async () => {
    const calls = use(() => ({}));
    useReviews.getState().toggleHelpful(RV);
    useReviews.getState().toggleHelpful(RV);
    useReviews.getState().toggleHelpful('demo-1');
    await flush();
    expect(calls.map((c) => [c.table, c.op])).toEqual([
      ['review_votes', 'insert'],
      ['review_votes', 'delete'],
    ]);
    expect(calls[0].payload).toEqual({ review_id: RV, user_id: 'user-1' });
    expect(useReviews.getState().helpfulIds).toEqual(['demo-1']);
  });

  it('Denunciar is "sent" only after the server accepted it', async () => {
    use(() => ({}));
    useReviews.getState().report(RV);
    expect(useReviews.getState().isReported(RV)).toBe(true);
    expect(useReviews.getState().isReportSent(RV)).toBe(false);
    await flush();
    expect(useReviews.getState().isReportSent(RV)).toBe(true);

    use(() => ({ error: { code: '42501', message: 'rls' } }));
    const other = '33333333-3333-4333-8333-333333333333';
    useReviews.getState().report(other);
    await flush();
    expect(useReviews.getState().isReported(other)).toBe(true);
    expect(useReviews.getState().isReportSent(other)).toBe(false);
  });

  it('pushReport writes review_reports with a reason', async () => {
    const calls = use(() => ({}));
    await expect(pushReport(RV)).resolves.toBe(true);
    expect(calls[0]).toMatchObject({ table: 'review_reports', op: 'insert' });
    expect(calls[0].payload).toMatchObject({ review_id: RV, user_id: 'user-1' });
  });

  it('adoptRemote takes the server status of my review unless an edit is unsent', () => {
    use(() => ({ error: { message: 'offline' } }));
    useReviews.setState({ mine: [{ ...mapReviewRow(row), mine: true, status: 'pending' }] });
    useReviews.getState().adoptRemote(EV, [{ ...mapReviewRow(row), mine: true }]);
    expect(useReviews.getState().mineFor(EV)!.status).toBe('published');
    useReviews.setState({ mine: [{ ...mapReviewRow(row), mine: true, status: 'pending' }], unsynced: [EV] });
    useReviews.getState().adoptRemote(EV, [{ ...mapReviewRow(row), mine: true }]);
    expect(useReviews.getState().mineFor(EV)!.status).toBe('pending');
  });
});

describe('not remote', () => {
  it('is a no-op: nothing is sent and no flags are set', async () => {
    mockRemote = false;
    const calls = use(() => ({}));
    useReviews.getState().submitReview({ eventId: EV, rating: 4 });
    useReviews.getState().toggleHelpful(RV);
    useReviews.getState().report(RV);
    await flush();
    expect(calls).toHaveLength(0);
    expect(useReviews.getState().unsynced).toEqual([]);
    expect(useReviews.getState().isReportSent(RV)).toBe(false);
    await expect(pullReviews(EV)).resolves.toEqual([]);
    await expect(pushReview({ ...mapReviewRow(row) })).resolves.toBeNull();
  });
});

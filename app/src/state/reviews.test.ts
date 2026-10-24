import { REVIEW_TEXT_MAX, cleanText, hasCheckin, setCheckinLookup, useReviews, validateReviewText } from './reviews';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

beforeEach(() => {
  setCheckinLookup(undefined);
  useReviews.setState({ mine: [], helpfulIds: [], reportedIds: [] });
});

describe('reviews store', () => {
  it('submits as pending, mine, and not attended without a check-in', () => {
    const r = useReviews.getState().submitReview({ eventId: 'e1', rating: 4, text: '  Muito bom  ', tags: ['Música boa'] });
    expect(r).toMatchObject({ status: 'pending', mine: true, attended: false, text: 'Muito bom', helpfulCount: 0, anonymous: false });
    expect(useReviews.getState().mineFor('e1')?.id).toBe(r.id);
  });

  it('marks attended only when the injected check-in lookup says so', () => {
    setCheckinLookup((id) => id === 'e1');
    expect(hasCheckin('e1')).toBe(true);
    expect(useReviews.getState().submitReview({ eventId: 'e1', rating: 5 }).attended).toBe(true);
    expect(useReviews.getState().submitReview({ eventId: 'e2', rating: 5 }).attended).toBe(false);
  });

  it('keeps one review per event (editing replaces it)', () => {
    useReviews.getState().submitReview({ eventId: 'e1', rating: 2 });
    useReviews.getState().submitReview({ eventId: 'e1', rating: 5 });
    expect(useReviews.getState().mine).toHaveLength(1);
    expect(useReviews.getState().mine[0].rating).toBe(5);
  });

  it('toggles helpful and reports idempotently', () => {
    const s = useReviews.getState();
    s.toggleHelpful('d1');
    expect(useReviews.getState().isHelpful('d1')).toBe(true);
    useReviews.getState().toggleHelpful('d1');
    expect(useReviews.getState().isHelpful('d1')).toBe(false);
    useReviews.getState().report('d1');
    useReviews.getState().report('d1');
    expect(useReviews.getState().reportedIds).toEqual(['d1']);
    expect(useReviews.getState().isReported('d1')).toBe(true);
  });

  it('cleans and validates text', () => {
    expect(cleanText('   ')).toBeUndefined();
    expect(cleanText('a'.repeat(900))).toHaveLength(REVIEW_TEXT_MAX);
    expect(validateReviewText('Som ótimo')).toBeUndefined();
    expect(validateReviewText('fale comigo em joao@mail.com')).toMatch(/e-mails e telefones/);
    expect(validateReviewText('me liga 27 99999-1234')).toMatch(/e-mails e telefones/);
    expect(validateReviewText('a'.repeat(REVIEW_TEXT_MAX + 1))).toMatch(/passou de 800/);
  });
});

describe('hasCheckin default lookup', () => {
  it('reads the persisted check-ins store', () => {
    const { useCheckins } = require('./checkins');
    setCheckinLookup(undefined);
    expect(hasCheckin('evt-x')).toBe(false);
    useCheckins.getState().checkIn('evt-x');
    expect(hasCheckin('evt-x')).toBe(true);
    useCheckins.setState({ checkins: [] });
  });
});

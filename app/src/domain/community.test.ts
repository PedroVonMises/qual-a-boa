import {
  defaultSort,
  effectiveHelpful,
  isValidHandle,
  sortComments,
  TOP_HELPFUL_MIN,
  topHelpful,
} from './community';

const c = (id: string, helpfulCount: number, createdAt: string) => ({ id, helpfulCount, createdAt });

describe('topHelpful', () => {
  it('returns nothing below the threshold', () => {
    expect(topHelpful([c('a', TOP_HELPFUL_MIN - 1, '2026-10-30T10:00:00Z')])).toBeUndefined();
  });

  it('picks the highest count at or above the threshold', () => {
    const list = [c('a', 3, '2026-10-30T10:00:00Z'), c('b', 9, '2026-10-30T09:00:00Z'), c('c', 2, '2026-10-30T11:00:00Z')];
    expect(topHelpful(list)?.id).toBe('b');
  });

  it('breaks ties by newest', () => {
    const list = [c('old', 5, '2026-10-30T08:00:00Z'), c('new', 5, '2026-10-30T12:00:00Z')];
    expect(topHelpful(list)?.id).toBe('new');
  });

  it("counts the viewer's own vote", () => {
    const list = [c('a', TOP_HELPFUL_MIN - 1, '2026-10-30T10:00:00Z')];
    expect(topHelpful(list, ['a'])?.id).toBe('a');
  });
});

describe('sortComments', () => {
  const list = [c('a', 1, '2026-10-30T10:00:00Z'), c('b', 7, '2026-10-30T08:00:00Z'), c('c', 7, '2026-10-30T09:00:00Z')];

  it('sorts by helpful then newest', () => {
    expect(sortComments(list, 'helpful').map((x) => x.id)).toEqual(['c', 'b', 'a']);
  });

  it('sorts by newest', () => {
    expect(sortComments(list, 'recent').map((x) => x.id)).toEqual(['a', 'c', 'b']);
  });

  it('does not mutate the input', () => {
    const copy = [...list];
    sortComments(list, 'recent');
    expect(list).toEqual(copy);
  });
});

describe('helpers', () => {
  it('effectiveHelpful adds one for a voted id', () => {
    expect(effectiveHelpful(c('a', 4, 'x'), ['a'])).toBe(5);
    expect(effectiveHelpful(c('a', 4, 'x'), [])).toBe(4);
  });

  it('agora defaults to recent, others to helpful', () => {
    expect(defaultSort('agora')).toBe('recent');
    expect(defaultSort('vale_a_pena')).toBe('helpful');
    expect(defaultSort('grupo')).toBe('helpful');
  });

  it('validates handles', () => {
    expect(isValidHandle('marina_vix')).toBe(true);
    expect(isValidHandle('ab')).toBe(false);
    expect(isValidHandle('Marina')).toBe(false);
    expect(isValidHandle('com espaço')).toBe(false);
  });
});

import {
  COMMUNITY_PAGE_SIZE,
  decodeKeyset,
  decodeOffset,
  encodeKeyset,
  threadMatchesQuery,
  threadQueryKey,
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

describe('paging cursors', () => {
  it('round-trips a keyset cursor, including timestamps with colons and offsets', () => {
    const k = { createdAt: '2026-10-30T20:00:00.123456+00:00', id: '22222222-2222-4222-8222-222222222222' };
    expect(decodeKeyset(encodeKeyset(k))).toEqual(k);
  });

  it('rejects malformed keyset cursors', () => {
    for (const bad of [null, undefined, '', 'nodivider', '|id', 'ts|']) expect(decodeKeyset(bad)).toBeNull();
  });

  it('reads an offset cursor, falling back to 0', () => {
    expect(decodeOffset('40')).toBe(40);
    for (const bad of [null, undefined, '', 'x', '-5']) expect(decodeOffset(bad)).toBe(0);
  });

  it('keeps one page size for every feed', () => {
    expect(COMMUNITY_PAGE_SIZE).toBe(20);
  });

  it('gives equal queries one cache key and different queries different keys', () => {
    const a = { scope: 'following' as const, sort: 'recent' as const, followedEventIds: ['b', 'a'] };
    const b = { scope: 'following' as const, sort: 'recent' as const, followedEventIds: ['a', 'b'] };
    expect(threadQueryKey(a)).toEqual(threadQueryKey(b));
    expect(threadQueryKey({ ...a, kind: 'agora' })).not.toEqual(threadQueryKey(a));
    expect(threadQueryKey({ ...a, sort: 'helpful' })).not.toEqual(threadQueryKey(a));
  });
});

describe('state scope', () => {
  const t = (uf?: string) => ({ eventId: 'e1', kind: 'vale_a_pena' as const, uf });
  const feed = { scope: 'all' as const, sort: 'recent' as const };

  it('the feed only shows its own state; content without a state reads as the default one (ES)', () => {
    expect(threadMatchesQuery(t('ES'), { ...feed, uf: 'ES' })).toBe(true);
    expect(threadMatchesQuery(t(undefined), { ...feed, uf: 'ES' })).toBe(true);
    expect(threadMatchesQuery(t('SP'), { ...feed, uf: 'ES' })).toBe(false);
    expect(threadMatchesQuery(t(undefined), { ...feed, uf: 'SP' })).toBe(false);
  });

  it("an event's own page and an unfiltered query ignore the state", () => {
    expect(threadMatchesQuery(t('SP'), feed)).toBe(true);
    expect(threadMatchesQuery(t('SP'), { ...feed, eventId: 'e1' })).toBe(true);
  });

  it('each state has its own cache entry', () => {
    expect(threadQueryKey({ ...feed, uf: 'ES' })).not.toEqual(threadQueryKey({ ...feed, uf: 'SP' }));
    expect(threadQueryKey({ ...feed, uf: 'ES' })).not.toEqual(threadQueryKey(feed));
  });
});

describe('threadMatchesQuery (mirrors the server filters)', () => {
  const t = (over: Partial<{ eventId: string; venueSlug: string; kind: 'vale_a_pena' | 'grupo' | 'agora'; archived: boolean }> = {}) => ({
    eventId: 'e1',
    kind: 'vale_a_pena' as const,
    ...over,
  });
  const base = { scope: 'all' as const, sort: 'recent' as const };

  it('hides archived threads from the feed but not the event page', () => {
    expect(threadMatchesQuery(t({ archived: true }), base)).toBe(false);
    expect(threadMatchesQuery(t({ archived: true }), { ...base, includeArchived: true })).toBe(true);
  });

  it('filters by kind and by tonight (agora)', () => {
    expect(threadMatchesQuery(t({ kind: 'grupo' }), { ...base, kind: 'agora' })).toBe(false);
    expect(threadMatchesQuery(t({ kind: 'agora' }), { ...base, scope: 'tonight' })).toBe(true);
    expect(threadMatchesQuery(t({ kind: 'grupo' }), { ...base, scope: 'tonight' })).toBe(false);
    expect(threadMatchesQuery(t({ kind: 'grupo' }), { ...base, scope: 'tonight', kind: 'grupo' })).toBe(false);
  });

  it('following needs a followed event id', () => {
    const q = { ...base, scope: 'following' as const, followedEventIds: ['e1'] };
    expect(threadMatchesQuery(t(), q)).toBe(true);
    expect(threadMatchesQuery(t({ eventId: 'e2' }), q)).toBe(false);
    expect(threadMatchesQuery(t(), { ...q, followedEventIds: [] })).toBe(false);
  });

  it('event page matches its own threads and venue-pinned demo threads only', () => {
    const q = { ...base, eventId: 'e1', venueSlug: 'casa-mare' };
    expect(threadMatchesQuery(t(), q)).toBe(true);
    expect(threadMatchesQuery(t({ eventId: 'e2' }), q)).toBe(false);
    expect(threadMatchesQuery({ kind: 'grupo', venueSlug: 'casa-mare' }, q)).toBe(true);
    expect(threadMatchesQuery({ kind: 'grupo', venueSlug: 'outra' }, q)).toBe(false);
  });
});

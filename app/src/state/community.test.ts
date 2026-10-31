jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { useCommunity } from './community';

const reset = () =>
  useCommunity.setState({ handle: undefined, threads: [], comments: [], votedIds: [], reportedIds: [], reportSentIds: [] });

const input = { eventId: 'e1', eventName: 'Noite do Pagodão', kind: 'vale_a_pena' as const, title: 'Vale a pena?', anonymous: false };

beforeEach(reset);

describe('handle', () => {
  it('normalises @ and case, rejects invalid handles', () => {
    expect(useCommunity.getState().setHandle('ab')).toMatch(/3 a 20/);
    expect(useCommunity.getState().setHandle('com espaço')).toMatch(/3 a 20/);
    expect(useCommunity.getState().setHandle('@Marina_Vix')).toBeUndefined();
    expect(useCommunity.getState().handle).toBe('marina_vix');
  });
});

describe('createThread', () => {
  it('requires a handle unless anonymous', () => {
    expect(useCommunity.getState().createThread(input)).toMatch(/Escolha seu @/);
    expect(useCommunity.getState().threads).toHaveLength(0);
  });

  it('stores an anonymous thread without handle or avatar', () => {
    const r = useCommunity.getState().createThread({ ...input, anonymous: true });
    expect(typeof r).toBe('object');
    const t = useCommunity.getState().threads[0];
    expect(t.author).toEqual({ anonymous: true });
    expect(t.mine).toBe(true);
  });

  it('keeps the handle for a named thread', () => {
    useCommunity.getState().setHandle('marina_vix');
    useCommunity.getState().createThread(input);
    expect(useCommunity.getState().threads[0].author).toMatchObject({ anonymous: false, handle: 'marina_vix' });
  });

  it('rejects an empty title and personal data', () => {
    useCommunity.getState().setHandle('marina_vix');
    expect(useCommunity.getState().createThread({ ...input, title: '  ' })).toMatch(/título/);
    expect(useCommunity.getState().createThread({ ...input, body: 'me chama 27 99999-1234' })).toMatch(/telefones/);
    expect(useCommunity.getState().threads).toHaveLength(0);
  });
});

describe('addComment', () => {
  it('rejects empty text and stores a trimmed reply', () => {
    expect(useCommunity.getState().addComment({ threadId: 't', body: '  ', anonymous: true })).toMatch(/sua resposta/);
    useCommunity.getState().addComment({ threadId: 't', parentId: 'p', body: '  oi  ', anonymous: true });
    const c = useCommunity.getState().comments[0];
    expect(c).toMatchObject({ body: 'oi', parentId: 'p', author: { anonymous: true } });
  });
});

describe('helpful and reports', () => {
  it('toggles a helpful vote on and off', () => {
    useCommunity.getState().toggleHelpful('c1');
    expect(useCommunity.getState().votedIds).toEqual(['c1']);
    useCommunity.getState().toggleHelpful('c1');
    expect(useCommunity.getState().votedIds).toEqual([]);
  });

  it('records a report once', () => {
    useCommunity.getState().report('c1', 'comment');
    useCommunity.getState().report('c1', 'comment');
    expect(useCommunity.getState().reportedIds).toEqual(['c1']);
  });
});

import { buildExport, exportFileName, wipeLocalData } from './accountData';
import { useCheckins } from './checkins';
import { useFavorites } from './favorites';
import { useFollows } from './follows';
import { useReviews } from './reviews';
import { useSession } from './session';
import { useSupport } from './support';
import { useTaste } from './taste';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const NOW = new Date('2026-10-28T15:00:00.000Z');

function seedStores() {
  useFavorites.setState({ eventIds: ['e1'], venueIds: ['bolt'], artistSlugs: ['dj-x'] });
  useCheckins.setState({ checkins: [{ eventId: 'e1', at: '2026-10-20T01:00:00.000Z' }], unsynced: [] });
  useFollows.setState({
    follows: { e1: { eventId: 'e1', followedAt: '2026-10-19T00:00:00.000Z', hasTicket: true, alerts: {}, channels: {} } as never },
    changes: [],
  });
  useReviews.setState({
    mine: [{ id: 'r1', eventId: 'e1', rating: 5, topics: {}, tags: [], anonymous: false, attended: true, status: 'pending', createdAt: '2026-10-21T00:00:00.000Z', helpfulCount: 0, mine: true }],
  });
  useSupport.setState({
    tickets: [{ id: 't1', topic: 'outro', description: 'oi', status: 'open', createdAt: '2026-10-22T00:00:00.000Z', messages: [] }],
  });
  useTaste.setState({ genres: { funk: { w: 2, at: 1 } }, views: [{ kind: 'event', id: 'e1', at: 1 }] });
}

describe('buildExport', () => {
  it('collects every personal record the app holds', () => {
    seedStores();
    const out = buildExport({ email: 'ana@exemplo.com', displayName: 'Ana' }, NOW);
    expect(out).toMatchObject({
      app: 'Qual a boa?',
      exportedAt: '2026-10-28T15:00:00.000Z',
      account: { email: 'ana@exemplo.com', displayName: 'Ana' },
      favorites: { events: ['e1'], venues: ['bolt'], artists: ['dj-x'] },
      checkins: [{ eventId: 'e1' }],
      reviews: [{ id: 'r1', rating: 5 }],
      supportTickets: [{ id: 't1' }],
    });
    expect(out.following).toEqual([expect.objectContaining({ eventId: 'e1', hasTicket: true })]);
  });

  it('is plain JSON (serializes without loss)', () => {
    seedStores();
    const out = buildExport({ email: null, displayName: null }, NOW);
    expect(JSON.parse(JSON.stringify(out))).toEqual(out);
  });

  it('exports empty collections for a fresh user', () => {
    useFavorites.setState({ eventIds: [], venueIds: [], artistSlugs: [] });
    useCheckins.setState({ checkins: [], unsynced: [] });
    useFollows.setState({ follows: {}, changes: [] });
    useReviews.setState({ mine: [] });
    useSupport.setState({ tickets: [] });
    const out = buildExport({ email: null, displayName: null }, NOW);
    expect(out.favorites).toEqual({ events: [], venues: [], artists: [] });
    expect(out.following).toEqual([]);
    expect(out.reviews).toEqual([]);
  });

  it('names the file by date', () => {
    expect(exportFileName(NOW)).toBe('qual-a-boa-meus-dados-2026-10-28.json');
  });
});

describe('wipeLocalData', () => {
  it('clears user data, recommendation taste and the session', () => {
    seedStores();
    useSession.setState({ ageConfirmed: true } as never);
    wipeLocalData();
    expect(useFavorites.getState()).toMatchObject({ eventIds: [], venueIds: [], artistSlugs: [] });
    expect(useCheckins.getState().checkins).toEqual([]);
    expect(useFollows.getState().follows).toEqual({});
    expect(useReviews.getState().mine).toEqual([]);
    expect(useSupport.getState().tickets).toEqual([]);
    expect(useTaste.getState().genres).toEqual({});
    expect(useTaste.getState().views).toEqual([]);
    expect(useSession.getState().ageConfirmed).toBeFalsy();
  });
});

import { buildExport, exportFileName, wipeLocalData } from './accountData';
import { useCheckins } from './checkins';
import { useFavorites } from './favorites';
import { useFollows } from './follows';
import { useLocation } from './location';
import { useProfile } from './profile';
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

  it('includes the registered phone and address', () => {
    useProfile.getState().clear();
    expect(buildExport({ email: null, displayName: null }, NOW).profile).toEqual({ phone: null, address: null });
    const address = { cep: '29060000', street: 'Rua A', number: '1', district: 'Centro', city: 'Vitória', uf: 'ES', lat: -20.3, lng: -40.3 };
    useProfile.getState().setPhone('27 99999-0000');
    useProfile.getState().setAddress(address);
    expect(buildExport({ email: null, displayName: null }, NOW).profile).toEqual({ phone: '27 99999-0000', address });
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

  it('clears the profile (phone/address) and both locations', () => {
    useProfile.getState().setPhone('27 3333-0000');
    useProfile.getState().setAddress({ cep: '29060000', street: 'Rua A', number: '1', district: 'Centro', city: 'Vitória', uf: 'ES', lat: -20.3, lng: -40.3 });
    useLocation.getState().setDeviceFix({ point: { lat: -20.31, lng: -40.3, label: 'X' }, accuracyM: 10, at: NOW.toISOString() });
    wipeLocalData();
    expect(useProfile.getState()).toMatchObject({ phone: undefined, address: undefined });
    expect(useLocation.getState()).toMatchObject({ live: null, registered: null, activeOrigin: 'default' });
  });
});

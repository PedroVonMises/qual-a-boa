import AsyncStorage from '@react-native-async-storage/async-storage';

import { setRepo } from '../index';
import type { Repo } from '../repo';
import { setSupabase } from '../supabaseClient';
import { useCheckins } from '@/state/checkins';
import { useFavorites } from '@/state/favorites';
import { useFollows } from '@/state/follows';
import { useLive } from '@/state/live';
import { pullCheckins, mergeCheckins } from './checkins';
import { mergeFavorites, pullFavorites, pushFavorite, setCatalog } from './favorites';
import { mergeFollows, pullFollows, pushFollow, pushUnfollow } from './follows';
import { fakeSupabase, type Call } from './fakeSupabase';
import { fetchLiveSummary, mapSummaryRow, pullLive, pushReport } from './live';
import { syncAll } from './index';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/env', () => ({ env: { dataSource: 'supabase', supabaseUrl: 'http://x', supabaseAnonKey: 'k' } }));

const flush = () => new Promise((r) => setTimeout(r, 0));
const rls = { code: '42501', message: 'new row violates row-level security policy' };

beforeEach(async () => {
  await AsyncStorage.clear();
  useFavorites.setState({ eventIds: [], venueIds: [], artistSlugs: [] });
  useFollows.setState({ follows: {}, changes: [] });
  useCheckins.setState({ checkins: [], unsynced: [] });
  useLive.setState({ reports: [], unsynced: [] });
  setCatalog(null);
  setRepo(null);
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  setSupabase(null);
  jest.restoreAllMocks();
});

describe('favorites', () => {
  const repo = {
    getVenue: jest.fn(async (slug: string) => (slug === 'casa-mare' ? { venue: { id: 'v-uuid' } } : null)),
    getArtist: jest.fn(async (slug: string) => (slug === 'dj-x' ? { artist: { id: 'a-uuid' } } : null)),
  } as unknown as Repo;

  it('pushes events by id and venues/artists by resolved uuid', async () => {
    setRepo(repo);
    const { client, calls } = fakeSupabase();
    setSupabase(client);
    await pushFavorite('event', 'e-uuid', true);
    await pushFavorite('venue', 'casa-mare', true);
    await pushFavorite('artist', 'dj-x', true);
    expect(calls.map((c) => c.payload)).toEqual([
      { kind: 'event', ref_id: 'e-uuid' },
      { kind: 'venue', ref_id: 'v-uuid' },
      { kind: 'artist', ref_id: 'a-uuid' },
    ]);
    expect(calls[0].op).toBe('upsert');
  });

  it('deletes by kind + ref_id and skips unknown slugs', async () => {
    setRepo(repo);
    const { client, calls } = fakeSupabase();
    setSupabase(client);
    await pushFavorite('venue', 'casa-mare', false);
    expect(calls[0].op).toBe('delete');
    expect(calls[0].filters).toEqual([['eq', ['kind', 'venue']], ['eq', ['ref_id', 'v-uuid']]]);
    expect(await pushFavorite('venue', 'nope', true)).toBe('failed');
    expect(calls).toHaveLength(1);
  });

  it('a store toggle pushes fire-and-forget', async () => {
    const { client, calls } = fakeSupabase();
    setSupabase(client);
    useFavorites.getState().toggleEvent('e1');
    expect(useFavorites.getState().eventIds).toEqual(['e1']);
    await flush();
    expect(calls[0]).toMatchObject({ table: 'favorites', op: 'upsert', payload: { kind: 'event', ref_id: 'e1' } });
    useFavorites.getState().toggleEvent('e1');
    await flush();
    expect(calls[1].op).toBe('delete');
  });

  it('a failing push never throws or blocks the toggle', async () => {
    const { client } = fakeSupabase(() => ({ error: { message: 'network' } }));
    setSupabase(client);
    expect(() => useFavorites.getState().toggleEvent('e1')).not.toThrow();
    await flush();
    expect(useFavorites.getState().eventIds).toEqual(['e1']);
  });

  it('merge: server rows win, local-only rows kept and reported', () => {
    const { merged, localOnly } = mergeFavorites(
      { eventIds: ['a', 'b'], venueIds: ['v1'], artistSlugs: [] },
      { eventIds: ['b', 'c'], venueIds: [], artistSlugs: ['x'] },
    );
    expect(merged).toEqual({ eventIds: ['b', 'c', 'a'], venueIds: ['v1'], artistSlugs: ['x'] });
    expect(localOnly).toEqual([{ kind: 'event', key: 'a' }, { kind: 'venue', key: 'v1' }]);
  });

  it('pull maps uuids to slugs, merges and uploads local-only', async () => {
    useFavorites.setState({ eventIds: ['local-ev'], venueIds: [], artistSlugs: [] });
    const { client, calls } = fakeSupabase((c: Call) => {
      if (c.table === 'favorites' && c.op === 'select')
        return { data: [{ kind: 'venue', ref_id: 'v-uuid' }, { kind: 'event', ref_id: 'srv-ev' }] };
      if (c.table === 'venues') return { data: [{ id: 'v-uuid', slug: 'casa-mare' }] };
      return { data: [] };
    });
    setSupabase(client);
    await pullFavorites();
    expect(useFavorites.getState().venueIds).toEqual(['casa-mare']);
    expect(useFavorites.getState().eventIds).toEqual(['srv-ev', 'local-ev']);
    expect(calls.find((c) => c.op === 'upsert')?.payload).toEqual({ kind: 'event', ref_id: 'local-ev' });
  });
});

describe('follows', () => {
  const f = {
    eventId: 'e1',
    followedAt: '2026-10-24T10:00:00.000Z',
    hasTicket: true,
    alerts: { lineup: true, price: false, lastTickets: true, dayBefore: true, cancelled: true },
    channels: { push: true, email: true },
  };

  it('maps to columns, including alert prefs', async () => {
    const { client, calls } = fakeSupabase();
    setSupabase(client);
    await pushFollow(f);
    expect(calls[0]).toMatchObject({
      table: 'event_follows',
      op: 'upsert',
      payload: { event_id: 'e1', followed_at: f.followedAt, has_ticket: true, alerts: f.alerts, channels: f.channels },
    });
    await pushUnfollow('e1');
    expect(calls[1]).toMatchObject({ op: 'delete', filters: [['eq', ['event_id', 'e1']]] });
  });

  it('store mutations push the updated follow', async () => {
    const { client, calls } = fakeSupabase();
    setSupabase(client);
    useFollows.getState().follow('e1');
    useFollows.getState().setAlert('e1', 'price', false);
    useFollows.getState().unfollow('e1');
    await flush();
    expect(calls.map((c) => c.op)).toEqual(['upsert', 'upsert', 'delete']);
    expect((calls[1].payload as { alerts: { price: boolean } }).alerts.price).toBe(false);
  });

  it('merge: server wins per event, local-only reported; pull applies it', async () => {
    const local = { e1: { ...f, hasTicket: false }, e2: { ...f, eventId: 'e2' } };
    const { merged, localOnly } = mergeFollows(local, [f]);
    expect(merged.e1.hasTicket).toBe(true);
    expect(localOnly.map((x) => x.eventId)).toEqual(['e2']);

    useFollows.setState({ follows: local });
    const { client, calls } = fakeSupabase((c) =>
      c.op === 'select'
        ? { data: [{ event_id: 'e1', followed_at: f.followedAt, has_ticket: true, alerts: { price: false }, channels: null }] }
        : undefined,
    );
    setSupabase(client);
    await pullFollows();
    const s = useFollows.getState().follows;
    expect(s.e1.alerts).toMatchObject({ price: false, lineup: true });
    expect(s.e1.channels).toEqual({ push: true, email: false });
    expect(calls.filter((c) => c.op === 'upsert').map((c) => (c.payload as { event_id: string }).event_id)).toEqual(['e2']);
  });
});

describe('checkins', () => {
  it('inserts only event_id (server stamps at)', async () => {
    const { client, calls } = fakeSupabase();
    setSupabase(client);
    useCheckins.getState().checkIn('e1');
    await flush();
    expect(calls[0]).toMatchObject({ table: 'checkins', op: 'insert', payload: { event_id: 'e1' } });
    expect(useCheckins.getState().unsynced).toEqual([]);
  });

  it('an RLS rejection keeps the local row, marks it unsynced and does not retry on pull', async () => {
    const { client, calls } = fakeSupabase((c) => (c.op === 'insert' ? { error: rls } : { data: [] }));
    setSupabase(client);
    useCheckins.getState().checkIn('e1');
    await flush();
    expect(useCheckins.getState().hasCheckedIn('e1')).toBe(true);
    expect(useCheckins.getState().unsynced).toEqual(['e1']);
    await pullCheckins();
    expect(calls.filter((c) => c.op === 'insert')).toHaveLength(1);
    expect(useCheckins.getState().unsynced).toEqual(['e1']);
  });

  it('a duplicate counts as synced; a network error is not marked unsynced', async () => {
    setSupabase(fakeSupabase(() => ({ error: { code: '23505' } })).client);
    useCheckins.getState().checkIn('e1');
    await flush();
    expect(useCheckins.getState().unsynced).toEqual([]);
    setSupabase(fakeSupabase(() => ({ error: { message: 'Failed to fetch' } })).client);
    useCheckins.getState().checkIn('e2');
    await flush();
    expect(useCheckins.getState().unsynced).toEqual([]);
  });

  it('merge: server `at` wins, local-only uploaded on pull', async () => {
    const { merged, localOnly } = mergeCheckins(
      [{ eventId: 'a', at: 'L' }, { eventId: 'b', at: 'L' }],
      [{ eventId: 'a', at: 'S' }],
    );
    expect(merged).toEqual([{ eventId: 'a', at: 'S' }, { eventId: 'b', at: 'L' }]);
    expect(localOnly).toEqual([{ eventId: 'b', at: 'L' }]);

    useCheckins.setState({ checkins: [{ eventId: 'b', at: 'L' }], unsynced: [] });
    const { client, calls } = fakeSupabase((c) => (c.op === 'select' ? { data: [{ event_id: 'a', at: 'S' }] } : undefined));
    setSupabase(client);
    await pullCheckins();
    expect(useCheckins.getState().checkins).toHaveLength(2);
    expect(calls.find((c) => c.op === 'insert')?.payload).toEqual({ event_id: 'b' });
  });
});

describe('live reports', () => {
  it('maps to columns and swaps the local id for the server id', async () => {
    const { client, calls } = fakeSupabase((c) => (c.op === 'insert' ? { data: { id: 'srv-1' } } : undefined));
    setSupabase(client);
    const r = useLive.getState().report({ eventId: 'e1', queue: 'short', priceAtDoor: 35 });
    await flush();
    expect(calls[0].payload).toEqual({ event_id: 'e1', queue: 'short', crowd: null, music: null, price_at_door: 35 });
    expect(r?.id.startsWith('local-')).toBe(true);
    expect(useLive.getState().reports[0].id).toBe('srv-1');
  });

  it('throttle / RLS rejection keeps the report, marks unsynced, no retry on pull', async () => {
    const { client, calls } = fakeSupabase((c) =>
      c.op === 'insert' ? { error: { code: '23514', message: 'report throttled: one per event every 10 minutes' } } : undefined,
    );
    setSupabase(client);
    const r = useLive.getState().report({ eventId: 'e1', crowd: 'full' })!;
    await flush();
    expect(useLive.getState().reports).toHaveLength(1);
    expect(useLive.getState().unsynced).toEqual([r.id]);
    await pullLive();
    expect(calls.filter((c) => c.op === 'insert')).toHaveLength(1);
  });

  it('pull uploads network-failed local reports and marks too-old ones unsynced', async () => {
    const now = Date.parse('2026-10-24T20:00:00Z');
    useLive.setState({
      reports: [
        { id: 'local-new', eventId: 'e1', at: '2026-10-24T19:00:00Z', crowd: 'busy' },
        { id: 'local-old', eventId: 'e1', at: '2026-10-24T05:00:00Z', crowd: 'busy' },
        { id: 'srv-x', eventId: 'e1', at: '2026-10-24T19:30:00Z', crowd: 'busy' },
      ],
      unsynced: [],
    });
    const { client, calls } = fakeSupabase((c) => (c.op === 'insert' ? { data: { id: 'srv-y' } } : undefined));
    setSupabase(client);
    await pullLive(now);
    expect(calls.filter((c) => c.op === 'insert')).toHaveLength(1);
    expect(useLive.getState().unsynced).toEqual(['local-old']);
    expect(useLive.getState().reports.map((r) => r.id)).toContain('srv-y');
  });

  it('maps event_live_summary rows (server aggregates) to LiveSummary', async () => {
    const row = {
      queue: 'long' as const, crowd: 'full' as const, music: null, price_at_door: '35.00',
      sample_size: 4, last_report_at: '2026-10-24T19:50:00Z',
    };
    const s = mapSummaryRow(row);
    expect(s.queue).toEqual({ value: 'long', at: row.last_report_at, n: 4, stale: false });
    expect(s.music).toBeUndefined();
    expect(s.price?.value).toBe(35);
    expect(s).toMatchObject({ freshCount: 4, allStale: false });
    expect(mapSummaryRow(undefined)).toMatchObject({ freshCount: 0, allStale: true });
    expect(mapSummaryRow({ ...row, queue: null, crowd: null, price_at_door: null, sample_size: 0 })).toMatchObject({
      allStale: true, lastAt: row.last_report_at, queue: undefined,
    });

    const { client, calls } = fakeSupabase(() => ({ data: [row] }));
    setSupabase(client);
    const got = await fetchLiveSummary('e1');
    expect(calls[0]).toMatchObject({ op: 'rpc', table: 'event_live_summary', payload: { p_event_id: 'e1' } });
    expect(got?.crowd?.value).toBe('full');
  });

  it('pushReport on its own reports rejection', async () => {
    setSupabase(fakeSupabase(() => ({ error: rls })).client);
    expect(await pushReport({ id: 'local-1', eventId: 'e1', at: 'x', crowd: 'busy' })).toBe('rejected');
  });
});

describe('syncAll', () => {
  it('runs all pulls once after sign-in', async () => {
    const { client, calls } = fakeSupabase();
    setSupabase(client);
    await syncAll();
    expect(calls.filter((c) => c.op === 'select').map((c) => c.table).sort()).toEqual(['checkins', 'event_follows', 'favorites']);
  });
});

import type { EventChange, LiveReport } from '@/domain/engage';
import { addCheckin, hasCheckin, useCheckins } from './checkins';
import {
  addChanges, emptyFollows, followEvent, markAllRead, markRead, setAlert, setChannel, setHasTicket, unfollowEvent, unreadCount, useFollows,
} from './follows';
import { addReport, buildReport, hasSignal, MAX_REPORTS, reportsFor, useLive, validPrice } from './live';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const NOW = '2026-10-23T15:00:00.000Z';
const ch = (id: string, eventId: string, at: string, read = false): EventChange => ({ id, eventId, kind: 'lineup', text: id, at, read });

describe('follows reducers', () => {
  it('follows once with defaults and does not mutate', () => {
    const a = followEvent(emptyFollows, 'e1', NOW);
    expect(emptyFollows.follows).toEqual({});
    expect(a.follows.e1).toMatchObject({ eventId: 'e1', hasTicket: false, channels: { push: true, email: false } });
    expect(Object.values(a.follows.e1.alerts).every(Boolean)).toBe(true);
    expect(followEvent(a, 'e1', 'later')).toBe(a);
  });
  it('sets alerts, channels and ticket only for followed events', () => {
    let d = followEvent(emptyFollows, 'e1', NOW);
    d = setAlert(d, 'e1', 'price', false);
    d = setChannel(d, 'e1', 'email', true);
    d = setHasTicket(d, 'e1', true);
    expect(d.follows.e1.alerts.price).toBe(false);
    expect(d.follows.e1.alerts.lineup).toBe(true);
    expect(d.follows.e1.channels.email).toBe(true);
    expect(d.follows.e1.hasTicket).toBe(true);
    expect(setAlert(d, 'nope', 'price', false)).toBe(d);
  });
  it('adds changes sorted, de-duplicated, only for followed events', () => {
    let d = followEvent(emptyFollows, 'e1', NOW);
    d = addChanges(d, [ch('a', 'e1', '2026-10-23T10:00:00Z'), ch('b', 'e1', '2026-10-23T12:00:00Z'), ch('x', 'e2', NOW)]);
    expect(d.changes.map((c) => c.id)).toEqual(['b', 'a']);
    expect(addChanges(d, [ch('a', 'e1', NOW)])).toBe(d);
  });
  it('marks read and counts unread', () => {
    let d = followEvent(emptyFollows, 'e1', NOW);
    d = followEvent(d, 'e2', NOW);
    d = addChanges(d, [ch('a', 'e1', '2026-10-23T10:00:00Z'), ch('b', 'e2', '2026-10-23T11:00:00Z')]);
    expect(unreadCount(d)).toBe(2);
    d = markRead(d, 'a');
    expect(unreadCount(d)).toBe(1);
    expect(unreadCount(d, 'e1')).toBe(0);
    d = markAllRead(d, 'e1');
    expect(unreadCount(d)).toBe(1);
    expect(unreadCount(markAllRead(d))).toBe(0);
  });
  it('unfollow drops the follow and its changes', () => {
    let d = followEvent(emptyFollows, 'e1', NOW);
    d = addChanges(d, [ch('a', 'e1', NOW)]);
    d = unfollowEvent(d, 'e1');
    expect(d).toEqual({ follows: {}, changes: [] });
  });
  it('store wires reducers', () => {
    useFollows.setState({ ...emptyFollows });
    useFollows.getState().follow('e9', NOW);
    useFollows.getState().setAlert('e9', 'cancelled', false);
    expect(useFollows.getState().isFollowing('e9')).toBe(true);
    expect(useFollows.getState().follows.e9.alerts.cancelled).toBe(false);
    useFollows.getState().unfollow('e9');
    expect(useFollows.getState().isFollowing('e9')).toBe(false);
  });
});

describe('checkins', () => {
  it('is idempotent and keeps the first check-in', () => {
    const a = addCheckin([], 'e1', NOW);
    const b = addCheckin(a, 'e1', '2027-01-01T00:00:00Z');
    expect(b).toBe(a);
    expect(hasCheckin(b, 'e1')).toBe(true);
    expect(hasCheckin(b, 'e2')).toBe(false);
  });
  it('store check-in', () => {
    useCheckins.setState({ checkins: [] });
    useCheckins.getState().checkIn('e1', NOW);
    expect(useCheckins.getState().hasCheckedIn('e1')).toBe(true);
  });
});

describe('live reports', () => {
  it('requires a signal and validates the price', () => {
    expect(hasSignal({})).toBe(false);
    expect(buildReport({ eventId: 'e1' }, 'r', NOW)).toBeNull();
    expect(buildReport({ eventId: 'e1', priceAtDoor: -5 }, 'r', NOW)).toBeNull();
    expect(buildReport({ eventId: 'e1', priceAtDoor: NaN }, 'r', NOW)).toBeNull();
    expect(validPrice(30.456)).toBe(30.46);
    expect(buildReport({ eventId: 'e1', queue: 'short', priceAtDoor: 30 }, 'r', NOW)).toEqual({
      id: 'r', eventId: 'e1', at: NOW, queue: 'short', priceAtDoor: 30,
    });
  });
  it('appends sorted, de-duplicated and capped', () => {
    const mk = (i: number): LiveReport => ({ id: `r${i}`, eventId: 'e1', at: new Date(Date.parse(NOW) + i * 1000).toISOString(), queue: 'none' });
    let list: LiveReport[] = [];
    for (let i = 0; i < MAX_REPORTS + 5; i++) list = addReport(list, mk(i));
    expect(list).toHaveLength(MAX_REPORTS);
    expect(list[0].id).toBe('r5');
    expect(addReport(list, mk(10))).toBe(list);
    expect(reportsFor(list, 'zzz')).toEqual([]);
  });
  it('store report', () => {
    useLive.setState({ reports: [] });
    expect(useLive.getState().report({ eventId: 'e1' }, NOW)).toBeNull();
    const r = useLive.getState().report({ eventId: 'e1', crowd: 'full' }, NOW);
    expect(r?.crowd).toBe('full');
    expect(useLive.getState().reports).toHaveLength(1);
  });
});

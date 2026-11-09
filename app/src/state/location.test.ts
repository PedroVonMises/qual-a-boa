import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_LOCATION, type GeoPoint } from '@/domain/types';
import type { DeviceFix } from '@/lib/location/types';
import { migrateLocationV1, resolveLocation, useLocation } from './location';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const LIVE: DeviceFix = { point: { lat: -20.31, lng: -40.3, label: 'Jardim da Penha' }, accuracyM: 30, at: '2026-11-09T10:00:00.000Z' };
const FAR: DeviceFix = { point: { lat: -23.55, lng: -46.63, label: 'SP' }, accuracyM: 30, at: '2026-11-09T10:00:00.000Z' };
const REG: GeoPoint = { lat: -20.34, lng: -40.29, label: 'Rua A, 10' };
const REG_FAR: GeoPoint = { lat: -23.5, lng: -46.6, label: 'Rua SP, 1' };

const resolve = (o: Partial<Parameters<typeof resolveLocation>[0]>) =>
  resolveLocation({ live: null, registered: null, preferred: 'live', permission: 'granted', ...o });

beforeEach(() => {
  useLocation.getState().resetLocation();
  useLocation.getState().setPermission('undetermined');
});

describe('resolveLocation', () => {
  it('preferred live: live when granted and inside the pilot', () => {
    expect(resolve({ live: LIVE, registered: REG })).toMatchObject({
      activeOrigin: 'live', source: 'device', location: LIVE.point, isCustom: true, accuracyM: 30, outsidePilot: false,
    });
  });

  it('preferred live: falls back to registered without permission or outside the pilot', () => {
    expect(resolve({ live: LIVE, registered: REG, permission: 'denied' })).toMatchObject({ activeOrigin: 'registered', source: 'area', location: REG, accuracyM: 0 });
    expect(resolve({ live: FAR, registered: REG })).toMatchObject({ activeOrigin: 'registered', source: 'area', outsidePilot: false, liveOutsidePilot: true });
    expect(resolve({ registered: REG })).toMatchObject({ activeOrigin: 'registered' });
  });

  it('preferred live: default when nothing usable; flagged outsidePilot only for a real outside fix', () => {
    expect(resolve({})).toMatchObject({ activeOrigin: 'default', source: 'default', location: DEFAULT_LOCATION, isCustom: false, outsidePilot: false });
    expect(resolve({ live: FAR })).toMatchObject({ activeOrigin: 'default', source: 'device', location: DEFAULT_LOCATION, isCustom: false, outsidePilot: true });
    expect(resolve({ live: FAR, registered: REG_FAR })).toMatchObject({ activeOrigin: 'default', outsidePilot: true });
    expect(resolve({ live: LIVE, permission: 'blocked' })).toMatchObject({ activeOrigin: 'default', source: 'default', outsidePilot: false });
  });

  it('preferred registered: registered, else live, else default', () => {
    expect(resolve({ preferred: 'registered', live: LIVE, registered: REG })).toMatchObject({ activeOrigin: 'registered', location: REG });
    expect(resolve({ preferred: 'registered', live: LIVE })).toMatchObject({ activeOrigin: 'live', location: LIVE.point });
    expect(resolve({ preferred: 'registered', live: LIVE, registered: REG_FAR })).toMatchObject({ activeOrigin: 'live' });
    expect(resolve({ preferred: 'registered' })).toMatchObject({ activeOrigin: 'default', outsidePilot: false });
    expect(resolve({ preferred: 'registered', live: FAR })).toMatchObject({ activeOrigin: 'default', source: 'default', outsidePilot: false });
  });

  it('updatedAt is the last fix time whatever the active origin', () => {
    expect(resolve({ preferred: 'registered', live: LIVE, registered: REG }).updatedAt).toBe(Date.parse(LIVE.at));
    expect(resolve({}).updatedAt).toBe(0);
  });
});

describe('store setters', () => {
  it('setDeviceFix always updates live and never changes the preferred origin', () => {
    const s = useLocation.getState();
    s.setArea(REG);
    expect(useLocation.getState()).toMatchObject({ preferred: 'registered', registered: REG, source: 'area' });
    useLocation.getState().setDeviceFix(LIVE);
    expect(useLocation.getState()).toMatchObject({ preferred: 'registered', live: LIVE, permission: 'granted', activeOrigin: 'registered', location: REG });
    useLocation.getState().setPreferred('live');
    expect(useLocation.getState()).toMatchObject({ activeOrigin: 'live', source: 'device', location: LIVE.point });
  });

  it('setLocation behaves like setArea; setRegistered keeps the preference', () => {
    useLocation.getState().setLocation(REG);
    expect(useLocation.getState()).toMatchObject({ preferred: 'registered', activeOrigin: 'registered' });
    useLocation.getState().setRegistered(null);
    expect(useLocation.getState()).toMatchObject({ preferred: 'registered', registered: null, activeOrigin: 'default' });
    useLocation.getState().setPreferred('live');
    useLocation.getState().setRegistered(REG);
    expect(useLocation.getState()).toMatchObject({ preferred: 'live', activeOrigin: 'registered' });
  });

  it('revoking permission drops the live point', () => {
    useLocation.getState().setDeviceFix(LIVE);
    expect(useLocation.getState().activeOrigin).toBe('live');
    useLocation.getState().setPermission('denied');
    expect(useLocation.getState()).toMatchObject({ activeOrigin: 'default', live: LIVE });
  });

  it('resetLocation clears both points and the preference, keeps the OS permission', () => {
    useLocation.getState().setDeviceFix(LIVE);
    useLocation.getState().setArea(REG);
    useLocation.getState().resetLocation();
    expect(useLocation.getState()).toMatchObject({
      live: null, registered: null, preferred: 'live', permission: 'granted', activeOrigin: 'default', location: DEFAULT_LOCATION,
    });
  });
});

describe('persistence', () => {
  it('migrates v1 area / device / default', () => {
    expect(migrateLocationV1({ location: REG, source: 'area', permission: 'denied' })).toEqual({ registered: REG, preferred: 'registered', permission: 'denied' });
    const dev = migrateLocationV1({ location: LIVE.point, source: 'device', updatedAt: Date.parse(LIVE.at), accuracyM: 30, permission: 'granted' });
    expect(dev).toEqual({ live: LIVE, preferred: 'live', permission: 'granted' });
    expect(migrateLocationV1({ location: DEFAULT_LOCATION, source: 'device', outsidePilot: true })).toEqual({ preferred: 'live' });
    expect(migrateLocationV1({ location: DEFAULT_LOCATION, source: 'default' })).toEqual({});
    expect(migrateLocationV1('junk')).toEqual({});
  });

  it('rehydrates a v1 blob into v2 with derived fields', async () => {
    await AsyncStorage.setItem('qab.location', JSON.stringify({ state: { location: REG, source: 'area', isCustom: true, permission: 'granted' }, version: 0 }));
    await useLocation.persist.rehydrate();
    expect(useLocation.getState()).toMatchObject({ registered: REG, preferred: 'registered', activeOrigin: 'registered', source: 'area', location: REG });
  });

  it('rehydrates v2 and rejects corrupt points', async () => {
    await AsyncStorage.setItem('qab.location', JSON.stringify({ state: { live: { point: 'bad' }, registered: REG, preferred: 'nope', permission: 'granted' }, version: 2 }));
    await useLocation.persist.rehydrate();
    expect(useLocation.getState()).toMatchObject({ live: null, registered: REG, preferred: 'live', activeOrigin: 'registered' });
    const stored = JSON.parse((await AsyncStorage.getItem('qab.location'))!);
    expect(stored.version).toBe(2);
    expect(Object.keys(stored.state).sort()).toEqual(['live', 'permission', 'preferred', 'registered']);
  });
});

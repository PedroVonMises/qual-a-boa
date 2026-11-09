import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { AppState, Platform } from 'react-native';

import { DEFAULT_LOCATION } from '@/domain/types';
import { useLocation } from '@/state/location';
import { geocodeAddress, isWatchedTab, refreshDeviceLocation, useForegroundLocationWatch } from '..';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
  geocodeAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

const L = Location as unknown as Record<string, jest.Mock>;
const granted = { granted: true, canAskAgain: true, status: 'granted' };
const REG = { lat: -20.34, lng: -40.29, label: 'Rua A, 10' };

beforeEach(() => {
  jest.resetAllMocks();
  L.reverseGeocodeAsync.mockResolvedValue([{ district: 'Jardim da Penha' }]);
  L.getForegroundPermissionsAsync.mockResolvedValue(granted);
  useLocation.getState().resetLocation();
  useLocation.getState().setPermission('undetermined');
});

describe('refreshDeviceLocation and the preferred origin', () => {
  it('a background refresh updates live but keeps registered preferred', async () => {
    useLocation.getState().setArea(REG);
    L.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: -20.31, longitude: -40.3, accuracy: 20 }, timestamp: Date.now() });
    await refreshDeviceLocation(false);
    expect(useLocation.getState()).toMatchObject({ preferred: 'registered', activeOrigin: 'registered', live: { point: { lat: -20.31 } } });
  });

  it('an explicit "use my location" switches the preference to live', async () => {
    useLocation.getState().setArea(REG);
    L.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: -20.31, longitude: -40.3, accuracy: 20 }, timestamp: Date.now() });
    await refreshDeviceLocation(true);
    expect(useLocation.getState()).toMatchObject({ preferred: 'live', activeOrigin: 'live', source: 'device' });
  });
});

describe('isWatchedTab', () => {
  it('matches Início and Mapa only', () => {
    expect(isWatchedTab('/')).toBe(true);
    expect(isWatchedTab('/mapa')).toBe(true);
    expect(isWatchedTab('/(tabs)/mapa')).toBe(true);
    expect(isWatchedTab('/comunidade')).toBe(false);
    expect(isWatchedTab('/evento/abc')).toBe(false);
  });
});

describe('useForegroundLocationWatch', () => {
  let appHandler: (s: string) => void = () => {};
  beforeEach(() => {
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, h: (s: string) => void) => {
      appHandler = h;
      return { remove: jest.fn() };
    }) as never);
  });

  it('watches on Início/Mapa with live preferred and granted; stops on other tabs, background or registered', async () => {
    const remove = jest.fn();
    let cb: (p: unknown) => void = () => {};
    L.watchPositionAsync.mockImplementation(async (_o: unknown, c: typeof cb) => {
      cb = c;
      return { remove };
    });
    useLocation.getState().setPermission('granted');
    useLocation.getState().setArea(REG); // preferred registered
    const { rerender, unmount } = await renderHook(({ path }: { path: string }) => useForegroundLocationWatch(path), {
      initialProps: { path: '/' },
    });
    await act(async () => {});
    expect(L.watchPositionAsync).not.toHaveBeenCalled();

    await act(async () => useLocation.getState().setPreferred('live'));
    await waitFor(() => expect(L.watchPositionAsync).toHaveBeenCalledTimes(1));
    await act(async () => {
      cb({ coords: { latitude: -20.32, longitude: -40.31, accuracy: 15 }, timestamp: Date.now() });
    });
    expect(useLocation.getState().live?.point.lat).toBe(-20.32);

    await rerender({ path: '/comunidade' });
    expect(remove).toHaveBeenCalledTimes(1);
    await rerender({ path: '/mapa' });
    await waitFor(() => expect(L.watchPositionAsync).toHaveBeenCalledTimes(2));
    await act(async () => appHandler('background'));
    expect(remove).toHaveBeenCalledTimes(2);
    await act(async () => appHandler('active'));
    await waitFor(() => expect(L.watchPositionAsync).toHaveBeenCalledTimes(3));
    await unmount();
  });

  it('does not watch without permission', async () => {
    await renderHook(() => useForegroundLocationWatch('/'));
    await act(async () => {});
    expect(L.watchPositionAsync).not.toHaveBeenCalled();
  });
});

describe('geocodeAddress', () => {
  const OS = Platform.OS;
  afterEach(() => {
    Platform.OS = OS;
  });

  it('returns the native geocode result as precise when inside the pilot', async () => {
    Platform.OS = 'ios';
    L.geocodeAsync.mockResolvedValue([{ latitude: -20.281, longitude: -40.291 }]);
    expect(await geocodeAddress('Rua da Lama, 10, Vitória - ES', { label: 'Rua da Lama, 10' })).toEqual({
      point: { lat: -20.281, lng: -40.291, label: 'Rua da Lama, 10' }, precise: true,
    });
  });

  it('falls back to the neighbourhood center on error, empty or outside the pilot', async () => {
    Platform.OS = 'android';
    L.geocodeAsync.mockRejectedValue(new Error('no grant'));
    expect(await geocodeAddress('x', { district: 'Jardim da Penha', label: 'R, 1' })).toEqual({
      point: { lat: -20.2788, lng: -40.2885, label: 'R, 1' }, precise: false,
    });
    L.geocodeAsync.mockResolvedValue([{ latitude: -23.5, longitude: -46.6 }]);
    expect((await geocodeAddress('SP')).precise).toBe(false);
    L.geocodeAsync.mockResolvedValue([]);
    const r = await geocodeAddress('Nada');
    expect(r).toEqual({ point: { lat: DEFAULT_LOCATION.lat, lng: DEFAULT_LOCATION.lng, label: 'Nada' }, precise: false });
  });

  it('never calls the native geocoder on web', async () => {
    Platform.OS = 'web';
    const r = await geocodeAddress('Rua A', { district: 'Centro' });
    expect(L.geocodeAsync).not.toHaveBeenCalled();
    expect(r).toMatchObject({ precise: false, point: { lat: -20.3194 } });
  });
});

import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { AppState } from 'react-native';

import { DEFAULT_LOCATION } from '@/domain/types';
import { useLocation } from '@/state/location';
import { safeMerge } from '@/state/safeMerge';
import {
  getFix,
  getPermission,
  isInPilotArea,
  labelFor,
  refreshDeviceLocation,
  requestPermission,
  useLocationRefresh,
  useLocationWatch,
} from '..';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

const L = Location as unknown as Record<string, jest.Mock>;
const granted = { granted: true, canAskAgain: true, status: 'granted' };
const coords = (latitude: number, longitude: number, accuracy: number | null = 25) => ({
  coords: { latitude, longitude, accuracy },
  timestamp: Date.now(),
});

beforeEach(() => {
  jest.resetAllMocks();
  L.reverseGeocodeAsync.mockResolvedValue([{ district: 'Jardim da Penha' }]);
  useLocation.getState().resetLocation();
  useLocation.getState().setPermission('undetermined');
});

describe('permission', () => {
  it('maps granted / undetermined / denied / blocked', async () => {
    L.getForegroundPermissionsAsync.mockResolvedValue(granted);
    expect(await getPermission()).toBe('granted');
    L.getForegroundPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true, status: 'undetermined' });
    expect(await getPermission()).toBe('undetermined');
    L.getForegroundPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true, status: 'denied' });
    expect(await getPermission()).toBe('denied');
    L.getForegroundPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false, status: 'denied' });
    expect(await getPermission()).toBe('blocked');
  });

  it('requestPermission reports blocked when the OS will not ask again', async () => {
    L.requestForegroundPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false, status: 'denied' });
    expect(await requestPermission()).toBe('blocked');
    L.requestForegroundPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true, status: 'denied' });
    expect(await requestPermission()).toBe('denied');
  });
});

describe('getFix', () => {
  it('returns the fix with accuracy and a neighbourhood label', async () => {
    L.getForegroundPermissionsAsync.mockResolvedValue(granted);
    L.getCurrentPositionAsync.mockResolvedValue(coords(-20.31, -40.3, 1800));
    const r = await getFix();
    expect(r).toMatchObject({ ok: true, fix: { accuracyM: 1800, point: { lat: -20.31, label: 'Jardim da Penha' } } });
  });

  it('denied and blocked never read the position', async () => {
    L.getForegroundPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true, status: 'denied' });
    expect(await getFix()).toEqual({ ok: false, reason: 'denied' });
    L.getForegroundPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false, status: 'denied' });
    expect(await getFix()).toEqual({ ok: false, reason: 'blocked' });
    expect(L.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('times out after 8s then falls back to the last known position', async () => {
    jest.useFakeTimers();
    try {
      L.getForegroundPermissionsAsync.mockResolvedValue(granted);
      L.getCurrentPositionAsync.mockReturnValue(new Promise(() => {}));
      L.getLastKnownPositionAsync.mockResolvedValue(coords(-20.29, -40.29, 300));
      const p = getFix();
      await jest.advanceTimersByTimeAsync(8100);
      const r = await p;
      expect(r).toMatchObject({ ok: true, fix: { accuracyM: 300 } });
    } finally {
      jest.useRealTimers();
    }
  });

  it('timeout with no last known position reports timeout', async () => {
    jest.useFakeTimers();
    try {
      L.getForegroundPermissionsAsync.mockResolvedValue(granted);
      L.getCurrentPositionAsync.mockReturnValue(new Promise(() => {}));
      L.getLastKnownPositionAsync.mockResolvedValue(null);
      const p = getFix();
      await jest.advanceTimersByTimeAsync(8100);
      expect(await p).toEqual({ ok: false, reason: 'timeout' });
    } finally {
      jest.useRealTimers();
    }
  });

  it('services off with no fallback is unavailable', async () => {
    L.getForegroundPermissionsAsync.mockResolvedValue(granted);
    L.getCurrentPositionAsync.mockRejectedValue(new Error('off'));
    L.getLastKnownPositionAsync.mockResolvedValue(null);
    expect(await getFix()).toEqual({ ok: false, reason: 'unavailable' });
  });
});

describe('labelFor', () => {
  it('falls back to "Perto de você" when geocoding fails or is empty', async () => {
    L.reverseGeocodeAsync.mockRejectedValue(new Error('no network'));
    expect(await labelFor({ lat: 1, lng: 2 })).toBe('Perto de você');
    L.reverseGeocodeAsync.mockResolvedValue([{ district: null, subregion: null }]);
    expect(await labelFor({ lat: 1, lng: 2 })).toBe('Perto de você');
    L.reverseGeocodeAsync.mockResolvedValue([{ district: null, subregion: 'Serra' }]);
    expect(await labelFor({ lat: 1, lng: 2 })).toBe('Serra');
  });
});

describe('pilot area and store', () => {
  it('isInPilotArea is true near Vitória and false far away', () => {
    expect(isInPilotArea({ lat: -20.31, lng: -40.3 })).toBe(true);
    expect(isInPilotArea({ lat: -23.55, lng: -46.63 })).toBe(false);
  });

  it('outside the pilot the search location stays the default, flagged', async () => {
    L.getForegroundPermissionsAsync.mockResolvedValue(granted);
    L.getCurrentPositionAsync.mockResolvedValue(coords(-23.55, -46.63));
    await refreshDeviceLocation(false);
    const s = useLocation.getState();
    expect(s.location).toEqual(DEFAULT_LOCATION);
    expect(s.source).toBe('device');
    expect(s.outsidePilot).toBe(true);
    expect(s.isCustom).toBe(false);
  });

  it('inside the pilot a device fix becomes the location', async () => {
    L.getForegroundPermissionsAsync.mockResolvedValue(granted);
    L.getCurrentPositionAsync.mockResolvedValue(coords(-20.31, -40.3, 2000));
    await refreshDeviceLocation(false);
    const s = useLocation.getState();
    expect(s).toMatchObject({ source: 'device', permission: 'granted', isCustom: true, outsidePilot: false, accuracyM: 2000 });
    expect(s.location.label).toBe('Jardim da Penha');
    expect(s.updatedAt).toBeGreaterThan(0);
  });

  it('refresh asks for permission only when asked and askable', async () => {
    L.getForegroundPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true, status: 'undetermined' });
    L.requestForegroundPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false, status: 'denied' });
    expect(await refreshDeviceLocation(false)).toEqual({ ok: false, reason: 'denied' });
    expect(L.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(await refreshDeviceLocation(true)).toEqual({ ok: false, reason: 'blocked' });
    expect(useLocation.getState().permission).toBe('blocked');
  });

  it('safeMerge keeps valid persisted fields and rejects corrupt ones', () => {
    const cur = useLocation.getState();
    const merged = safeMerge(
      { source: 'device', permission: 'granted', updatedAt: 123, accuracyM: 'bad', outsidePilot: true },
      cur,
    );
    expect(merged).toMatchObject({ source: 'device', permission: 'granted', updatedAt: 123, outsidePilot: true });
    expect(merged.accuracyM).toBe(0);
    expect(safeMerge('garbage', cur)).toBe(cur);
  });

  it('setArea marks source=area and isCustom', () => {
    useLocation.getState().setArea({ lat: -20.3, lng: -40.3, label: 'Jardim da Penha' });
    expect(useLocation.getState()).toMatchObject({ source: 'area', isCustom: true });
    useLocation.getState().resetLocation();
    expect(useLocation.getState()).toMatchObject({ source: 'default', isCustom: false });
  });
});

describe('hooks', () => {
  it('useLocationRefresh refreshes a stale device fix on AppState active', async () => {
    let handler: (s: string) => void = () => {};
    const remove = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, h: (s: string) => void) => {
      handler = h;
      return { remove };
    }) as never);
    L.getForegroundPermissionsAsync.mockResolvedValue(granted);
    L.getCurrentPositionAsync.mockResolvedValue(coords(-20.31, -40.3));
    useLocation.getState().setDeviceFix({
      point: { lat: -20.3, lng: -40.3, label: 'X' },
      accuracyM: 10,
      at: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
    });
    const { unmount } = await renderHook(() => useLocationRefresh());
    await act(async () => {
      handler('active');
    });
    expect(L.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
    // fresh now: another activation does not refetch
    await act(async () => {
      handler('active');
    });
    expect(L.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
    await unmount();
    expect(remove).toHaveBeenCalled();
  });

  it('useLocationRefresh ignores non-device sources', async () => {
    let handler: (s: string) => void = () => {};
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, h: (s: string) => void) => {
      handler = h;
      return { remove: jest.fn() };
    }) as never);
    const { unmount } = await renderHook(() => useLocationRefresh());
    await act(async () => {
      handler('active');
    });
    expect(L.getForegroundPermissionsAsync).not.toHaveBeenCalled();
    await unmount();
  });

  it('useLocationWatch subscribes with distanceInterval 50 and cleans up', async () => {
    const remove = jest.fn();
    let cb: (p: ReturnType<typeof coords>) => void = () => {};
    L.getForegroundPermissionsAsync.mockResolvedValue(granted);
    L.watchPositionAsync.mockImplementation(async (_o: unknown, c: typeof cb) => {
      cb = c;
      return { remove };
    });
    const { result, rerender, unmount } = await renderHook(({ on }: { on: boolean }) => useLocationWatch(on), {
      initialProps: { on: true },
    });
    await waitFor(() => expect(L.watchPositionAsync).toHaveBeenCalled());
    expect(L.watchPositionAsync).toHaveBeenCalledWith(expect.objectContaining({ distanceInterval: 50 }), expect.any(Function));
    await act(async () => {
      cb(coords(-20.32, -40.31));
    });
    expect(result.current?.point.lat).toBe(-20.32);
    await rerender({ on: false });
    expect(remove).toHaveBeenCalled();
    await unmount();
  });

  it('useLocationWatch does nothing without permission or when disabled', async () => {
    L.getForegroundPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true, status: 'denied' });
    renderHook(() => useLocationWatch(true));
    renderHook(() => useLocationWatch(false));
    await act(async () => {});
    expect(L.watchPositionAsync).not.toHaveBeenCalled();
  });
});

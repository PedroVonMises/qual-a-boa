import { getSupabase } from '../supabaseClient';
import { useCheckins } from '@/state/checkins';
import { useFavorites } from '@/state/favorites';
import { useFollows } from '@/state/follows';
import { useLive } from '@/state/live';
import { syncAll } from './index';
import { pullCheckins, pushCheckin } from './checkins';
import { pullFavorites, pushFavorite } from './favorites';
import { pullFollows, pushFollow, pushUnfollow } from './follows';
import { pullLive, pushReport } from './live';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Default env = seed data: isRemote() is false, everything must be a silent no-op.
describe('not remote', () => {
  it('has no client and every push/pull is a no-op', async () => {
    expect(getSupabase()).toBeNull();
    expect(await pushFavorite('event', 'e1', true)).toBe('skipped');
    expect(await pushFollow(undefined)).toBe('skipped');
    expect(await pushUnfollow('e1')).toBe('skipped');
    expect(await pushCheckin('e1')).toBe('skipped');
    expect(await pushReport({ id: 'local-1', eventId: 'e1', at: 'x', crowd: 'busy' })).toBe('skipped');
    await Promise.all([pullFavorites(), pullFollows(), pullCheckins(), pullLive(), syncAll()]);
  });

  it('stores behave exactly as before', () => {
    useFavorites.getState().toggleVenue('casa-mare');
    expect(useFavorites.getState().venueIds).toContain('casa-mare');
    useFollows.getState().follow('e1');
    useFollows.getState().setAlert('e1', 'price', false);
    expect(useFollows.getState().follows.e1.alerts.price).toBe(false);
    useCheckins.getState().checkIn('e1');
    expect(useCheckins.getState().hasCheckedIn('e1')).toBe(true);
    expect(useCheckins.getState().unsynced).toEqual([]);
    expect(useLive.getState().report({ eventId: 'e1', crowd: 'full' })).not.toBeNull();
    expect(useLive.getState().unsynced).toEqual([]);
  });
});

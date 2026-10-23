import { defaultFilters } from '@/domain/filters';
import { DEFAULT_LOCATION } from '@/domain/types';
import { useFavorites } from './favorites';
import { useFilters } from './filters';
import { useLocation } from './location';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('stores', () => {
  it('filters: toggleGenre, set and reset', () => {
    useFilters.getState().toggleGenre('funk');
    useFilters.getState().toggleGenre('rock');
    useFilters.getState().toggleGenre('funk');
    expect(useFilters.getState().filters.genreSlugs).toEqual(['rock']);
    useFilters.getState().set({ priceMax: 0 });
    expect(useFilters.getState().filters.priceMax).toBe(0);
    useFilters.getState().reset();
    expect(useFilters.getState().filters).toEqual(defaultFilters);
  });

  it('favorites toggle on and off', () => {
    const s = useFavorites.getState();
    s.toggleEvent('e01');
    expect(useFavorites.getState().isEventFavorite('e01')).toBe(true);
    useFavorites.getState().toggleEvent('e01');
    expect(useFavorites.getState().isEventFavorite('e01')).toBe(false);
    useFavorites.getState().toggleVenue('v1');
    expect(useFavorites.getState().venueIds).toEqual(['v1']);
  });

  it('location defaults and custom', () => {
    expect(useLocation.getState().location).toEqual(DEFAULT_LOCATION);
    useLocation.getState().setLocation({ lat: 1, lng: 2, label: 'x' });
    expect(useLocation.getState().isCustom).toBe(true);
    useLocation.getState().resetLocation();
    expect(useLocation.getState().isCustom).toBe(false);
  });
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_UF, isPilotUf, isUf, PILOT_UFS, REGIONS, ufName } from '@/domain/region';
import { useRegion } from './region';

beforeEach(async () => {
  await AsyncStorage.clear();
  useRegion.setState({ uf: DEFAULT_UF });
});

describe('regions', () => {
  it('lists the 27 units once each, alphabetically, with Espírito Santo among them', () => {
    expect(REGIONS).toHaveLength(27);
    expect(new Set(REGIONS.map((r) => r.uf)).size).toBe(27);
    const names = REGIONS.map((r) => r.name);
    expect([...names].sort((a, b) => a.localeCompare(b, 'pt-BR'))).toEqual(names);
    expect(ufName('ES')).toBe('Espírito Santo');
  });

  it('only Espírito Santo is open during the pilot', () => {
    expect(PILOT_UFS).toEqual(['ES']);
    expect(REGIONS.filter((r) => isPilotUf(r.uf)).map((r) => r.uf)).toEqual(['ES']);
    expect(isUf('SP')).toBe(true);
    expect(isPilotUf('SP')).toBe(false);
    expect(isUf('XX')).toBe(false);
    expect(isUf(undefined)).toBe(false);
  });

  it('names an unknown code as itself', () => {
    expect(ufName('XX')).toBe('XX');
  });
});

describe('useRegion', () => {
  it('starts on the default state', () => {
    expect(useRegion.getState().uf).toBe('ES');
  });

  it('accepts a pilot state and refuses one that is not open yet', () => {
    expect(useRegion.getState().setUf('ES')).toBe(true);
    expect(useRegion.getState().setUf('SP')).toBe(false);
    expect(useRegion.getState().setUf('lixo')).toBe(false);
    expect(useRegion.getState().uf).toBe('ES');
  });

  it('keeps only valid stored values when it rehydrates', async () => {
    await AsyncStorage.setItem('qab.region', JSON.stringify({ state: { uf: 'SP' }, version: 0 }));
    await useRegion.persist.rehydrate();
    expect(useRegion.getState().uf).toBe('ES'); // SP is not open: fall back, do not break the feed

    await AsyncStorage.setItem('qab.region', JSON.stringify({ state: { uf: 42 }, version: 0 }));
    await useRegion.persist.rehydrate();
    expect(useRegion.getState().uf).toBe('ES');

    await AsyncStorage.setItem('qab.region', JSON.stringify({ state: { uf: 'ES' }, version: 0 }));
    await useRegion.persist.rehydrate();
    expect(useRegion.getState().uf).toBe('ES');
  });
});

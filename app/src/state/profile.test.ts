import AsyncStorage from '@react-native-async-storage/async-storage';

import { useLocation } from './location';
import { addressLabel, useProfile, type ProfileAddress } from './profile';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const ADDR: ProfileAddress = {
  cep: '29060000', street: 'Rua da Lama', number: '10', district: 'Jardim da Penha', city: 'Vitória', uf: 'ES', lat: -20.28, lng: -40.29,
};

beforeEach(() => {
  useProfile.getState().clear();
  useLocation.getState().resetLocation();
});

describe('profile store', () => {
  it('setAddress saves it and sets the registered location without changing the preference', () => {
    useProfile.getState().setAddress(ADDR);
    expect(useProfile.getState().address).toEqual(ADDR);
    expect(useLocation.getState()).toMatchObject({
      registered: { lat: -20.28, lng: -40.29, label: 'Rua da Lama, 10' }, preferred: 'live', activeOrigin: 'registered',
    });
    expect(addressLabel(ADDR)).toBe('Rua da Lama, 10');
  });

  it('phone is trimmed; clear removes phone, address and the registered location', () => {
    useProfile.getState().setPhone('  27 99999-0000 ');
    useProfile.getState().setAddress(ADDR);
    expect(useProfile.getState().phone).toBe('27 99999-0000');
    useProfile.getState().clear();
    expect(useProfile.getState()).toMatchObject({ phone: undefined, address: undefined });
    expect(useLocation.getState().registered).toBeNull();
  });

  it('clearAddress keeps the phone', () => {
    useProfile.getState().setPhone('27 3333-0000');
    useProfile.getState().setAddress(ADDR);
    useProfile.getState().clearAddress();
    expect(useProfile.getState()).toMatchObject({ phone: '27 3333-0000', address: undefined });
    expect(useLocation.getState().registered).toBeNull();
  });

  it('rehydrates valid data and drops a corrupt address', async () => {
    await AsyncStorage.setItem('qab.profile.v1', JSON.stringify({ state: { phone: '27', address: { ...ADDR, lat: 'x' } }, version: 0 }));
    await useProfile.persist.rehydrate();
    expect(useProfile.getState()).toMatchObject({ phone: '27', address: undefined });
    await AsyncStorage.setItem('qab.profile.v1', JSON.stringify({ state: { address: ADDR }, version: 0 }));
    await useProfile.persist.rehydrate();
    expect(useProfile.getState().address).toEqual(ADDR);
  });
});

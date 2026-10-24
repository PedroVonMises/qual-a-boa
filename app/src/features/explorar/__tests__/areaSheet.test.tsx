import '@/ui/testSetup';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { Linking } from 'react-native';

import { useFilters } from '@/state/filters';
import { useLocation } from '@/state/location';
import { AreaSheet } from '../AreaSheet';
import { Header } from '../Header';
import { setupFeatureTest } from '../testUtils';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

const L = Location as unknown as Record<string, jest.Mock>;
let renderWithData: ReturnType<typeof setupFeatureTest>;
const onClose = jest.fn();

beforeEach(() => {
  jest.resetAllMocks();
  renderWithData = setupFeatureTest();
  useLocation.getState().resetLocation();
  useLocation.getState().setPermission('undetermined');
  L.reverseGeocodeAsync.mockResolvedValue([{ district: 'Jardim da Penha' }]);
});

const pos = (accuracy: number) => ({ coords: { latitude: -20.31, longitude: -40.3, accuracy }, timestamp: Date.now() });

describe('AreaSheet "Perto de mim"', () => {
  it('requests the device fix, stores it and closes', async () => {
    L.getForegroundPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true, status: 'undetermined' });
    L.requestForegroundPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true, status: 'granted' });
    L.getForegroundPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: true, status: 'undetermined' });
    L.getCurrentPositionAsync.mockResolvedValue(pos(30));
    // after the request the permission is granted for the fix read
    L.getForegroundPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true, status: 'granted' });
    await renderWithData(<AreaSheet visible onClose={onClose} />);
    await fireEvent.press(await screen.findByRole('button', { name: /Perto de mim/ }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(useLocation.getState()).toMatchObject({ source: 'device', permission: 'granted' });
    expect(useLocation.getState().location.label).toBe('Jardim da Penha');
    expect(useFilters.getState().filters.area).toBeNull();
  });

  it('blocked: shows the message and an "Abrir configurações" row, sheet stays open', async () => {
    L.getForegroundPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false, status: 'denied' });
    const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    await renderWithData(<AreaSheet visible onClose={onClose} />);
    await fireEvent.press(await screen.findByRole('button', { name: /Perto de mim/ }));
    expect(await screen.findByTestId('area-message')).toHaveTextContent(/bloqueada/);
    expect(onClose).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: /Abrir configurações/ }));
    expect(open).toHaveBeenCalled();
  });

  it('outside the pilot area says so and keeps the default location', async () => {
    L.getForegroundPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true, status: 'granted' });
    L.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: -23.55, longitude: -46.63, accuracy: 20 }, timestamp: Date.now() });
    await renderWithData(<AreaSheet visible onClose={onClose} />);
    await fireEvent.press(await screen.findByRole('button', { name: /Perto de mim/ }));
    expect(await screen.findByTestId('area-message')).toHaveTextContent(/Fora da área piloto \(Grande Vitória\)/);
    expect(onClose).not.toHaveBeenCalled();
    expect(useLocation.getState().outsidePilot).toBe(true);
  });
});

describe('Header location chip', () => {
  it('shows "(aproximada)" for coarse fixes', async () => {
    useLocation.getState().setDeviceFix({ point: { lat: -20.31, lng: -40.3, label: 'Jardim da Penha' }, accuracyM: 3000, at: new Date().toISOString() });
    await renderWithData(<Header onPickArea={jest.fn()} />);
    expect(screen.getByTestId('location-chip')).toHaveTextContent(/Jardim da Penha \(aproximada\)/);
  });

  it('shows the plain label for precise fixes and the pilot message when outside', async () => {
    useLocation.getState().setDeviceFix({ point: { lat: -20.31, lng: -40.3, label: 'Jardim da Penha' }, accuracyM: 40, at: new Date().toISOString() });
    const view = await renderWithData(<Header onPickArea={jest.fn()} />);
    expect(screen.getByTestId('location-chip')).not.toHaveTextContent('aproximada');
    view.unmount();
    useLocation.getState().setDeviceFix({ point: { lat: -23.55, lng: -46.63, label: 'SP' }, accuracyM: 40, at: new Date().toISOString() });
    await renderWithData(<Header onPickArea={jest.fn()} />);
    expect(screen.getByTestId('location-chip')).toHaveTextContent(/Fora da área piloto/);
  });
});

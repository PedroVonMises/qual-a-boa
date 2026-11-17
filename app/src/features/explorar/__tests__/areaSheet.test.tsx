import '@/ui/testSetup';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { Linking } from 'react-native';

import { useFilters } from '@/state/filters';
import { useLocation } from '@/state/location';
import { useProfile } from '@/state/profile';
import { AreaSheet } from '../AreaSheet';
import { Header } from '../Header';
import { setupFeatureTest } from '../testUtils';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
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
  useProfile.getState().clear();
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
    await fireEvent.press(await screen.findByRole('radio', { name: /Perto de mim agora/ }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(useLocation.getState()).toMatchObject({ source: 'device', permission: 'granted' });
    expect(useLocation.getState().location.label).toBe('Jardim da Penha');
    expect(useFilters.getState().filters.area).toBeNull();
  });

  it('blocked: shows the message and an "Abrir configurações" row, sheet stays open', async () => {
    L.getForegroundPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false, status: 'denied' });
    const open = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    await renderWithData(<AreaSheet visible onClose={onClose} />);
    await fireEvent.press(await screen.findByRole('radio', { name: /Perto de mim agora/ }));
    expect(await screen.findByTestId('area-message')).toHaveTextContent(/bloqueada/);
    expect(onClose).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: /Abrir configurações/ }));
    expect(open).toHaveBeenCalled();
  });

  it('outside the pilot area says so and keeps the default location', async () => {
    L.getForegroundPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true, status: 'granted' });
    L.getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: -23.55, longitude: -46.63, accuracy: 20 }, timestamp: Date.now() });
    await renderWithData(<AreaSheet visible onClose={onClose} />);
    await fireEvent.press(await screen.findByRole('radio', { name: /Perto de mim agora/ }));
    expect(await screen.findByTestId('area-message')).toHaveTextContent(/Fora da área piloto \(Grande Vitória\)/);
    expect(onClose).not.toHaveBeenCalled();
    expect(useLocation.getState().outsidePilot).toBe(true);
  });
});

const fix = (label: string, accuracyM: number, lat = -20.31, lng = -40.3) =>
  useLocation.getState().setDeviceFix({ point: { lat, lng, label }, accuracyM, at: new Date().toISOString() });
const ADDRESS = { cep: '29055000', street: 'R. Joaquim Lírio', number: '823', district: 'Praia do Canto', city: 'Vitória', uf: 'ES', lat: -20.3, lng: -40.29 };

describe('AreaSheet origins', () => {
  it('shows both origins as radios; without an address "Perto de casa" is disabled and there is no address shortcut', async () => {
    fix('Jardim da Penha', 30);
    await renderWithData(<AreaSheet visible onClose={onClose} />);
    expect(screen.getByText('CONTAR A DISTÂNCIA A PARTIR DE')).toBeTruthy();
    expect(screen.getByText('OU FILTRAR POR BAIRRO')).toBeTruthy();
    const live = screen.getByRole('radio', { name: /Perto de mim agora, Tempo real · Jardim da Penha · agora há pouco/ });
    expect(live).toBeChecked();
    const home = screen.getByRole('radio', { name: /Perto de casa, Nenhum endereço cadastrado/ });
    expect(home).not.toBeChecked();
    expect(home).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Cadastrar endereço' })).toBeNull();
  });

  it('"Perto de casa" sets the registered origin, clears the area filter and closes', async () => {
    fix('Jardim da Penha', 30);
    useProfile.getState().setAddress(ADDRESS);
    useFilters.getState().set({ area: 'Centro' });
    await renderWithData(<AreaSheet visible onClose={onClose} />);
    await fireEvent.press(screen.getByRole('radio', { name: /Perto de casa, R\. Joaquim Lírio, 823/ }));
    expect(useLocation.getState()).toMatchObject({ preferred: 'registered', activeOrigin: 'registered' });
    expect(useFilters.getState().filters.area).toBeNull();
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: /Perto de casa/ })).toBeChecked();
    expect(screen.queryByRole('button', { name: 'Cadastrar endereço' })).toBeNull();
  });

  it('neighbourhood chips filter by area', async () => {
    await renderWithData(<AreaSheet visible onClose={onClose} />);
    expect(await screen.findByRole('button', { name: 'Todos os bairros' })).toBeSelected();
    await fireEvent.press(await screen.findByRole('button', { name: 'Praia do Canto' }));
    expect(useFilters.getState().filters.area).toBe('Praia do Canto');
    expect(onClose).toHaveBeenCalled();
  });
});

describe('Header location chip', () => {
  it('shows "(aproximada)" for coarse fixes', async () => {
    useLocation.getState().setDeviceFix({ point: { lat: -20.31, lng: -40.3, label: 'Jardim da Penha' }, accuracyM: 3000, at: new Date().toISOString() });
    await renderWithData(<Header onPickArea={jest.fn()} />);
    expect(screen.getByTestId('location-chip')).toHaveTextContent(/Agora · Jardim da Penha \(aproximada\)/);
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

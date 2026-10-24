import '@/ui/testSetup';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import type { ReactNode } from 'react';
import { Linking } from 'react-native';

import { setRepo } from '@/data';
import { miniDataset } from '@/data/__fixtures__/mini';
import { SeedRepo } from '@/data/seedRepo';
import { DEFAULT_LOCATION } from '@/domain/types';
import { useFilters } from '@/state/filters';
import { useLocation } from '@/state/location';
import { useSession } from '@/state/session';
import { HIDDEN } from '@/ui/testHelpers';
import { IdadeView } from '../IdadeView';
import { LocalView } from '../LocalView';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, push: jest.fn() }) }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  reverseGeocodeAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));
const mockOpenSettings = jest.fn();
jest.spyOn(Linking, 'openSettings').mockImplementation(mockOpenSettings);

const getPerm = Location.getForegroundPermissionsAsync as jest.Mock;
const reqPerm = Location.requestForegroundPermissionsAsync as jest.Mock;
const perm = {
  mockResolvedValue: (v: { granted: boolean; canAskAgain?: boolean }) => {
    const r = { status: v.granted ? 'granted' : 'denied', canAskAgain: true, ...v };
    getPerm.mockResolvedValue(v.granted ? r : { ...r, status: 'undetermined' });
    reqPerm.mockResolvedValue(r);
  },
};
const pos = Location.getCurrentPositionAsync as jest.Mock;

const wrap = (ui: ReactNode) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

beforeEach(() => {
  jest.clearAllMocks();
  (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue([{ district: 'Jardim da Penha' }]);
  setRepo(new SeedRepo(miniDataset));
  useSession.setState({ ageConfirmed: false, onboardingDone: false });
  useLocation.getState().resetLocation();
  useFilters.getState().reset();
});

describe('Idade', () => {
  it('confirms age and goes to local', async () => {
    await render(<IdadeView />);
    expect(screen.getByText('Beba com moderação. Se beber, não dirija.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Tenho 18 anos ou mais' }));
    expect(useSession.getState().ageConfirmed).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith('/onboarding/local');
  });

  it('blocks minors with no way forward', async () => {
    await render(<IdadeView />);
    await fireEvent.press(screen.getByRole('button', { name: 'Sou menor de idade' }));
    expect(screen.getByText('Você precisa ter 18 anos ou mais para usar o app')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Tenho 18 anos ou mais' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Fechar o app' })).toBeTruthy();
    expect(useSession.getState().ageConfirmed).toBe(false);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

describe('Local', () => {
  it('shows step, illustration and saves default genres', async () => {
    await wrap(<LocalView />);
    expect(screen.getByText('2 de 2')).toBeTruthy();
    expect(screen.getByTestId('radius-art', HIDDEN)).toBeTruthy();
    await fireEvent.press(await screen.findByRole('button', { name: 'Funk' }));
    expect(useFilters.getState().filters.genreSlugs).toEqual(['funk']);
  });

  it('granted: stores device location and finishes onboarding', async () => {
    perm.mockResolvedValue({ granted: true });
    pos.mockResolvedValue({ coords: { latitude: -20.31, longitude: -40.3, accuracy: 20 }, timestamp: Date.now() });
    await wrap(<LocalView />);
    await fireEvent.press(screen.getByRole('button', { name: 'Usar minha localização' }));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(useLocation.getState().location).toMatchObject({ lat: -20.31, lng: -40.3 });
    expect(useLocation.getState().isCustom).toBe(true);
    expect(useLocation.getState().source).toBe('device');
    expect(useLocation.getState().location.label).toBe('Jardim da Penha');
    expect(useSession.getState().onboardingDone).toBe(true);
  });

  it('explains why before the system prompt', async () => {
    await wrap(<LocalView />);
    expect(screen.getByTestId('location-rationale')).toHaveTextContent(/permissão de localização do seu aparelho/);
  });

  it('blocked: distinct copy, opens settings, offers the area fallback', async () => {
    perm.mockResolvedValue({ granted: false, canAskAgain: false });
    await wrap(<LocalView />);
    await fireEvent.press(screen.getByRole('button', { name: 'Usar minha localização' }));
    expect(await screen.findByText(/bloqueada para o app/)).toBeTruthy();
    expect(screen.queryByText(/Sem permissão de localização/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Escolher o bairro' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Abrir configurações' }));
    expect(mockOpenSettings).toHaveBeenCalled();
    expect(useSession.getState().onboardingDone).toBe(false);
  });

  it('denied: shows message, keeps default location, does not finish', async () => {
    perm.mockResolvedValue({ granted: false });
    await wrap(<LocalView />);
    await fireEvent.press(screen.getByRole('button', { name: 'Usar minha localização' }));
    expect(await screen.findByText(/Sem permissão de localização/)).toBeTruthy();
    expect(pos).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Abrir configurações' })).toBeNull();
    expect(useLocation.getState().location).toEqual(DEFAULT_LOCATION);
    expect(useSession.getState().onboardingDone).toBe(false);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('unavailable: shows message and offers the area fallback', async () => {
    perm.mockResolvedValue({ granted: true });
    pos.mockRejectedValue(new Error('Location services disabled'));
    await wrap(<LocalView />);
    await fireEvent.press(screen.getByRole('button', { name: 'Usar minha localização' }));
    expect(await screen.findByText(/Não deu para pegar sua localização/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Escolher o bairro' })).toBeTruthy();
    expect(useSession.getState().onboardingDone).toBe(false);
  });

  it('manual area selection sets location and finishes', async () => {
    await wrap(<LocalView />);
    await fireEvent.press(screen.getByRole('button', { name: 'Escolher o bairro' }));
    await act(async () => {});
    await fireEvent.press(await screen.findByRole('button', { name: 'Jardim da Penha' }));
    expect(useLocation.getState().location.label).toBe('Jardim da Penha');
    expect(useLocation.getState().isCustom).toBe(true);
    expect(useSession.getState().onboardingDone).toBe(true);
    expect(useSession.getState().ageConfirmed).toBe(true);
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('back returns to idade', async () => {
    await wrap(<LocalView />);
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar' }));
    expect(mockReplace).toHaveBeenCalledWith('/onboarding/idade');
  });
});
import '@/ui/testSetup';
import { screen } from '@testing-library/react-native';

import { useLocation } from '@/state/location';
import { useProfile } from '@/state/profile';
import { Header } from '../Header';
import { setupFeatureTest } from '../testUtils';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

let renderWithData: ReturnType<typeof setupFeatureTest>;
const fix = (label: string, accuracyM: number) =>
  useLocation.getState().setDeviceFix({ point: { lat: -20.31, lng: -40.3, label }, accuracyM, at: new Date().toISOString() });
const ADDRESS = { cep: '29055000', street: 'R. Joaquim Lírio', number: '823', district: 'Praia do Canto', city: 'Vitória', uf: 'ES', lat: -20.3, lng: -40.29 };

beforeEach(() => {
  renderWithData = setupFeatureTest();
  useProfile.getState().clear();
  useLocation.getState().resetLocation();
});

describe('Header origin chip', () => {
  it('live origin: "Agora · bairro" with the radius', async () => {
    fix('Jardim da Penha', 30);
    await renderWithData(<Header onPickArea={jest.fn()} />);
    expect(screen.getByTestId('location-chip')).toHaveTextContent(/Agora · Jardim da Penha/);
    expect(screen.getByTestId('location-chip')).toHaveTextContent(/10 km/);
    await screen.findByRole('button', { name: 'Rock' }); // let the genre query settle before the next test
  });

  it('registered address origin: "Casa"; hand-picked neighbourhood keeps its name', async () => {
    useProfile.getState().setAddress(ADDRESS);
    useLocation.getState().setPreferred('registered');
    const view = await renderWithData(<Header onPickArea={jest.fn()} />);
    expect(screen.getByTestId('location-chip')).toHaveTextContent(/Casa/);
    expect(screen.getByTestId('location-chip')).toHaveTextContent(/10 km/);
    await screen.findByRole('button', { name: 'Rock' });
    view.unmount();
    useProfile.getState().clear();
    useLocation.getState().setArea({ lat: -20.29, lng: -40.29, label: 'Praia do Canto' });
    await renderWithData(<Header onPickArea={jest.fn()} />);
    expect(screen.getByTestId('location-chip')).toHaveTextContent(/Praia do Canto/);
    expect(screen.getByTestId('location-chip')).not.toHaveTextContent(/Casa/);
    await screen.findByRole('button', { name: 'Rock' });
  });
});

import '@/ui/testSetup';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { setRepo, SeedRepo } from '@/data';
import { miniDataset } from '@/data/__fixtures__/mini';
import { PRIVACY } from '@/features/perfil/legalText';
import { useLocation } from '@/state/location';
import { useProfile } from '@/state/profile';
import { PrivacidadeScreen } from '../PrivacidadeScreen';

const mockPush = jest.fn();
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
}));

const renderScreen = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PrivacidadeScreen />
    </QueryClientProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  setRepo(new SeedRepo(miniDataset));
  useProfile.getState().clear();
  useLocation.getState().resetLocation();
});

describe('Privacidade: two locations', () => {
  it('says the live location stays on the device and the address is saved in the account', async () => {
    await renderScreen();
    expect(screen.getByText(/Sua localização em tempo real, as buscas recentes/)).toBeTruthy();
    expect(screen.getByText(/O endereço que você cadastra fica salvo na sua conta, e você pode apagar quando quiser/)).toBeTruthy();
    expect(screen.queryByText(/nunca é enviada/)).toBeNull();
  });

  it('"Endereço cadastrado" row shows the address and opens Dados cadastrais', async () => {
    useProfile.getState().setAddress({ cep: '29055000', street: 'R. Joaquim Lírio', number: '823', district: 'Praia do Canto', city: 'Vitória', uf: 'ES', lat: -20.3, lng: -40.29 });
    await renderScreen();
    expect(screen.getByTestId('privacidade-endereco')).toHaveTextContent(/R\. Joaquim Lírio, 823/);
    await fireEvent.press(screen.getByTestId('privacidade-endereco'));
    expect(mockPush).toHaveBeenCalledWith('/dados-cadastrais');
  });

  it('the privacy policy no longer says the location is never sent', () => {
    const text = PRIVACY.paragraphs.join(' ');
    expect(text).not.toMatch(/nunca é enviada/);
    expect(text).toMatch(/tempo real fica somente neste aparelho/);
    expect(text).toMatch(/fica salvo na sua conta/);
  });
});

import '@/ui/testSetup';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { setRepo } from '@/data';
import { resetCasasDemo, useCasasDemo } from '@/data/casas';
import { env } from '@/lib/env';
import { miniDataset } from '@/data/__fixtures__/mini';
import { SeedRepo } from '@/data/seedRepo';
import { useDemoLoaded } from '@/state/demo';
import { useFavorites } from '@/state/favorites';
import { useFilters } from '@/state/filters';
import { useLocation } from '@/state/location';
import { useProfile } from '@/state/profile';
import { useSession } from '@/state/session';
import { PerfilView } from '../PerfilView';

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: mockReplace }) }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const renderPerfil = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PerfilView />
    </QueryClientProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  setRepo(new SeedRepo(miniDataset));
  useFilters.getState().reset();
});

describe('Perfil', () => {
  it('shows visitor header and a disabled login button', async () => {
    await renderPerfil();
    expect(screen.getByText('Visitante')).toBeTruthy();
    expect(screen.getByText('Login chega em breve')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Entrar para sincronizar' })).toBeDisabled();
    // No backend on a seed-data build, so there is no account to manage.
    expect(screen.queryByTestId('perfil-conta')).toBeNull();
  });

  it('"Raio padrão" slider updates the filters store within bounds', async () => {
    await renderPerfil();
    expect(screen.getByText('Raio padrão')).toBeTruthy();
    expect(useFilters.getState().filters.radiusKm).toBe(10);
    expect(screen.getByTestId('radius-value')).toHaveTextContent('Até 10 km');
    await fireEvent.press(screen.getByRole('button', { name: 'Até 25 km' }));
    expect(useFilters.getState().filters.radiusKm).toBe(25);
    const slider = screen.getByTestId('radius-stepper');
    await fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(useFilters.getState().filters.radiusKm).toBe(25);
    await fireEvent.press(screen.getByRole('button', { name: 'Até 1 km' }));
    await fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(useFilters.getState().filters.radiusKm).toBe(1);
    expect(screen.getByTestId('radius-value')).toHaveTextContent('Até 1 km');
  });

  it('favorite styles sheet toggles genres in the store', async () => {
    await renderPerfil();
    await fireEvent.press(screen.getByRole('button', { name: /Estilos favoritos/ }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Rock' }));
    expect(useFilters.getState().filters.genreSlugs).toEqual(['rock']);
  });

  it('alerts switch exposes switch role and checked state', async () => {
    await renderPerfil();
    const sw = screen.getByRole('switch', { name: 'Avisos de eventos salvos' });
    expect(sw).toBeChecked();
    await fireEvent.press(sw);
    expect(screen.getByRole('switch', { name: 'Avisos de eventos salvos' })).not.toBeChecked();
  });

  it('privacy row opens the Privacidade screen', async () => {
    await renderPerfil();
    await fireEvent.press(screen.getByRole('button', { name: 'Privacidade e dados (LGPD)' }));
    expect(mockPush).toHaveBeenCalledWith('/privacidade');
  });

  it('nightclub row opens the venue panel for members', async () => {
    resetCasasDemo();
    await renderPerfil();
    expect(screen.getByText('PARA CASAS NOTURNAS')).toBeTruthy();
    expect(await screen.findByText('Painel da casa')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('perfil-casas'));
    expect(mockPush).toHaveBeenCalledWith('/casas/painel');
  });

  it('nightclub row pitches the plan to people without a venue', async () => {
    useCasasDemo.setState({ accounts: [] });
    try {
      await renderPerfil();
      expect(await screen.findByText('Sua casa no Qual a boa?')).toBeTruthy();
      await fireEvent.press(screen.getByTestId('perfil-casas'));
      expect(mockPush).toHaveBeenCalledWith('/casas');
    } finally {
      resetCasasDemo();
    }
  });

  it('legal rows open placeholder drafts', async () => {
    await renderPerfil();
    await fireEvent.press(screen.getByRole('button', { name: 'Termos de uso' }));
    expect(await screen.findByText('rascunho')).toBeTruthy();
  });

  it('help row links to /ajuda and dev reset clears the session', async () => {
    useSession.setState({ ageConfirmed: true, onboardingDone: true });
    await renderPerfil();
    await fireEvent.press(screen.getByRole('button', { name: 'Ajuda e suporte' }));
    expect(mockPush).toHaveBeenCalledWith('/ajuda');
    await fireEvent.press(screen.getByRole('button', { name: /Refazer a verificação de idade/ }));
    expect(useSession.getState().ageConfirmed).toBe(false);
    expect(mockReplace).toHaveBeenCalledWith('/onboarding/idade');
  });
  it('demo section loads, clears and resets', async () => {
    useSession.setState({ ageConfirmed: true, onboardingDone: true });
    await renderPerfil();
    expect(screen.getByText('DADOS DE DEMONSTRAÇÃO')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Carregar dados de exemplo' }));
    expect(useDemoLoaded.getState().loaded).toBe(true);
    expect(useFavorites.getState().venueIds.length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Limpar dados de exemplo' }));
    expect(useDemoLoaded.getState().loaded).toBe(false);
    expect(useFavorites.getState().venueIds).toEqual([]);
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar ao início (resetar app)' }));
    expect(useSession.getState().ageConfirmed).toBe(false);
    expect(mockReplace).toHaveBeenCalledWith('/onboarding/idade');
  });
  it('hides the demo section when demo tools are off (production builds)', async () => {
    const mutable = env as { demoTools: boolean };
    const prev = mutable.demoTools;
    mutable.demoTools = false;
    try {
      useSession.setState({ ageConfirmed: true, onboardingDone: true });
      await renderPerfil();
      expect(screen.queryByText('DADOS DE DEMONSTRAÇÃO')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Carregar dados de exemplo' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Voltar ao início (resetar app)' })).toBeTruthy();
    } finally {
      mutable.demoTools = prev;
    }
  });
});

describe('Perfil localização', () => {
  beforeEach(() => {
    useLocation.getState().resetLocation();
    useLocation.getState().setPermission('undetermined');
    useProfile.getState().clear();
  });

  it('shows both origins, the default point, refresh and the new privacy note; settings only when blocked', async () => {
    await renderPerfil();
    expect(screen.getByTestId('origin-live')).toHaveTextContent(/Permitir localização/);
    // The address is edited only in Dados cadastrais: no address row in LOCALIZAÇÃO.
    expect(screen.queryByTestId('origin-registered')).toBeNull();
    expect(screen.getByTestId('origin-default')).toHaveTextContent(/ponto padrão/);
    expect(screen.getByText('Alterar bairro')).toBeTruthy();
    expect(screen.getByText('Atualizar localização')).toBeTruthy();
    expect(screen.getByText(/Sua localização em tempo real fica só neste aparelho\. O endereço que você cadastra fica salvo na sua conta/)).toBeTruthy();
    expect(screen.queryByText(/nunca é enviada/)).toBeNull();
    expect(screen.queryByText('Abrir configurações')).toBeNull();
  });

  it('blocked: offers Abrir configurações', async () => {
    useLocation.getState().setPermission('blocked');
    await renderPerfil();
    expect(screen.getByTestId('origin-live')).toHaveTextContent(/Bloqueada nas configurações/);
    expect(screen.getByText('Abrir configurações')).toBeTruthy();
  });

  it('segmented control switches the preferred origin; statuses show the live fix and the address', async () => {
    useLocation.getState().setDeviceFix({ point: { lat: -20.29, lng: -40.29, label: 'Jardim da Penha' }, accuracyM: 30, at: new Date(Date.now() - 2 * 60_000).toISOString() });
    useProfile.getState().setAddress({ cep: '29055000', street: 'R. Joaquim Lírio', number: '823', district: 'Praia do Canto', city: 'Vitória', uf: 'ES', lat: -20.3, lng: -40.29 });
    await renderPerfil();
    expect(screen.getByLabelText('Calcular distância a partir de')).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Tempo real' })).toBeSelected();
    expect(screen.getByTestId('origin-live')).toHaveTextContent(/Agora em Jardim da Penha · há 2 min/);
    expect(screen.getByTestId('origin-live')).toHaveTextContent(/Em uso/);
    await fireEvent.press(screen.getByRole('tab', { name: 'Endereço' }));
    expect(useLocation.getState().preferred).toBe('registered');
    expect(useLocation.getState().activeOrigin).toBe('registered');
    expect(screen.getByRole('tab', { name: 'Endereço' })).toBeSelected();
    await fireEvent.press(screen.getByRole('tab', { name: 'Tempo real' }));
    expect(useLocation.getState().preferred).toBe('live');
  });

  it('only the "Dados cadastrais" row leads to the address', async () => {
    await renderPerfil();
    expect(screen.queryByRole('button', { name: /^Endereço/ })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Dados cadastrais, Nome, contato e endereço' }));
    expect(mockPush).toHaveBeenCalledWith('/dados-cadastrais');
  });
});

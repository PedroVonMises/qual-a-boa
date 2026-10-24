import '@/ui/testSetup';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { setRepo } from '@/data';
import { miniDataset } from '@/data/__fixtures__/mini';
import { SeedRepo } from '@/data/seedRepo';
import { useDemoLoaded } from '@/state/demo';
import { useFavorites } from '@/state/favorites';
import { useFilters } from '@/state/filters';
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
  });

  it('radius stepper updates the filters store within bounds', async () => {
    await renderPerfil();
    expect(useFilters.getState().filters.radiusKm).toBe(10);
    await fireEvent.press(screen.getByRole('button', { name: 'Aumentar raio' }));
    expect(useFilters.getState().filters.radiusKm).toBe(25);
    expect(screen.getByRole('button', { name: 'Aumentar raio' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Diminuir raio' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Diminuir raio' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Diminuir raio' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Diminuir raio' }));
    expect(useFilters.getState().filters.radiusKm).toBe(1);
    expect(screen.getByRole('button', { name: 'Diminuir raio' })).toBeDisabled();
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
});
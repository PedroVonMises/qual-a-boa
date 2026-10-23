import '@/ui/testSetup';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { SeedRepo, setRepo } from '@/data';
import { MINI_NOW, miniDataset } from '@/data/__fixtures__/mini';
import { useFavorites } from '@/state/favorites';
import { SalvosScreen } from '../SalvosScreen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const ui = () => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <SalvosScreen now={MINI_NOW} />
  </QueryClientProvider>
);

beforeEach(() => {
  mockPush.mockClear();
  setRepo(new SeedRepo(miniDataset, () => Date.parse(MINI_NOW)));
  useFavorites.setState({ eventIds: [], venueIds: [] });
});

describe('SalvosScreen', () => {
  it('groups saved events by date and labels cancelled and past items', async () => {
    useFavorites.setState({ eventIds: ['e01', 'e05', 'e08', 'e10', 'e09'] });
    await render(ui());
    expect(await screen.findByText('Esta semana')).toBeTruthy();
    expect(screen.getByText('Mais tarde')).toBeTruthy();
    expect(screen.getByText('Já passaram')).toBeTruthy();
    expect(screen.getByText('Cancelado')).toBeTruthy();
    expect(screen.getByText('Já passou')).toBeTruthy();
    expect(screen.getByText('Evento removido')).toBeTruthy();
    expect(screen.getByText('Acompanhando · 0')).toBeTruthy();
  });

  it('removes with an undo toast and restores on undo', async () => {
    useFavorites.setState({ eventIds: ['e01'] });
    await render(ui());
    await screen.findByText('Noite do Funk');
    await fireEvent.press(screen.getByTestId('saved-e01-save'));
    expect(useFavorites.getState().eventIds).toEqual([]);
    expect(screen.getByText('Evento removido dos salvos')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Desfazer' }));
    expect(useFavorites.getState().eventIds).toEqual(['e01']);
    expect(screen.queryByText('Evento removido dos salvos')).toBeNull();
  });

  it('auto-dismisses the toast after 5 seconds', async () => {
    jest.useFakeTimers();
    useFavorites.setState({ eventIds: ['e01'] });
    await render(ui());
    await screen.findByText('Noite do Funk');
    await fireEvent.press(screen.getByTestId('saved-e01-save'));
    await act(async () => {
      jest.advanceTimersByTime(5100);
    });
    expect(screen.queryByText('Evento removido dos salvos')).toBeNull();
    jest.useRealTimers();
  });

  it('shows an empty state per tab with the explore CTA', async () => {
    await render(ui());
    expect(screen.getByText('Nenhum evento salvo')).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: 'Casas' }));
    expect(screen.getByText('Nenhuma casa salva')).toBeTruthy();
    await fireEvent.press(screen.getByRole('tab', { name: 'Artistas' }));
    expect(screen.getByText('Nenhum artista salvo')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Explorar eventos' }));
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('links the Acompanhando pill and lists saved venues', async () => {
    useFavorites.setState({ venueIds: ['bolt'] });
    await render(ui());
    await fireEvent.press(screen.getByRole('link', { name: 'Acompanhando, 1' }));
    expect(mockPush).toHaveBeenCalledWith('/acompanhar');
    await fireEvent.press(screen.getByRole('tab', { name: 'Casas' }));
    expect(await screen.findByText('Bolt Club')).toBeTruthy();
  });
});

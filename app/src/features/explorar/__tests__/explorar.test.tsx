import '@/ui/testSetup';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { useFavorites } from '@/state/favorites';
import { useFilters } from '@/state/filters';
import { ExplorarScreen } from '../ExplorarScreen';
import { setupFeatureTest } from '../testUtils';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: jest.fn(() => ({})),
}));

let renderWithData: ReturnType<typeof setupFeatureTest>;
beforeEach(() => {
  jest.clearAllMocks();
  renderWithData = setupFeatureTest();
});

describe('Explorar', () => {
  it('renders the headline, genre chips and the four shelves', async () => {
    await renderWithData(<ExplorarScreen />);
    expect(await screen.findByText('Hoje à noite')).toBeOnTheScreen();
    expect(screen.getByText('Este fim de semana')).toBeOnTheScreen();
    expect(screen.getByText('Até R$ 40')).toBeOnTheScreen();
    expect(screen.getByText('Perto de você')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Tudo' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Funk' })).toBeOnTheScreen();
    expect(screen.queryByText('Nada aceso por aqui')).toBeNull();
  });

  it('selecting a genre updates the store and swaps shelves for the result list', async () => {
    await renderWithData(<ExplorarScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Funk' }));
    expect(useFilters.getState().filters.genreSlugs).toEqual(['funk']);
    expect(await screen.findByTestId('result-count')).toHaveTextContent(/\d+ eventos?/);
    expect(screen.queryByText('Hoje à noite')).toBeNull();
    expect(await screen.findAllByText(/Noite do Funk/)).not.toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Funk', selected: true })).toBeOnTheScreen();
  });

  it('typing in the search bar writes a debounced query into the store', async () => {
    await renderWithData(<ExplorarScreen />);
    await fireEvent.changeText(await screen.findByTestId('search-input'), 'pagode');
    expect(useFilters.getState().filters.query).toBe('');
    await waitFor(() => expect(useFilters.getState().filters.query).toBe('pagode'));
    expect(await screen.findAllByText(/Pagode da Selva/)).not.toHaveLength(0);
  });

  it('changing the sort updates the store', async () => {
    useFilters.getState().set({ genreSlugs: ['funk'] });
    await renderWithData(<ExplorarScreen />);
    await fireEvent.press(await screen.findByRole('tab', { name: 'Preço' }));
    expect(useFilters.getState().filters.sort).toBe('price');
    await fireEvent.press(screen.getByRole('tab', { name: 'Popularidade' }));
    expect(useFilters.getState().filters.sort).toBe('popularity');
  });

  it('empty state: expands the radius, then clears filters', async () => {
    useFilters.getState().set({ query: 'zzzzz', radiusKm: 3 });
    await renderWithData(<ExplorarScreen />);
    expect(await screen.findByText('Nada aceso por aqui')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Aumentar o raio para 10 km' }));
    expect(useFilters.getState().filters.radiusKm).toBe(10);
    await fireEvent.press(await screen.findByRole('button', { name: 'Limpar filtros' }));
    expect(useFilters.getState().filters.query).toBe('');
    expect(await screen.findByText('Hoje à noite')).toBeOnTheScreen();
  });

  it('filter button shows the active count and opens /filtros', async () => {
    useFilters.getState().set({ priceMax: 40, genreSlugs: ['funk'] });
    await renderWithData(<ExplorarScreen />);
    const btn = await screen.findByRole('button', { name: 'Filtros, 2 ativos' });
    await fireEvent.press(btn);
    expect(router.push).toHaveBeenCalledWith('/filtros');
  });

  it('card press navigates to the event and the heart toggles favorites', async () => {
    useFilters.getState().set({ genreSlugs: ['funk'] });
    await renderWithData(<ExplorarScreen />);
    const card = (await screen.findAllByRole('button', { name: /Noite do Funk/ }))[0];
    await fireEvent.press(card);
    expect(router.push).toHaveBeenCalledWith({ pathname: '/evento/[id]', params: { id: 'e01' } });
    await fireEvent.press(await screen.findByTestId('event-e01-save'));
    expect(useFavorites.getState().eventIds).toContain('e01');
  });
});

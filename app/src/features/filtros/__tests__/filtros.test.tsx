import '@/ui/testSetup';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import { filtersToUrlParams, urlParamsToFilters } from '@/domain/filters';
import { setupFeatureTest } from '@/features/explorar/testUtils';
import { useFilters } from '@/state/filters';
import { FiltrosScreen } from '../FiltrosScreen';

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
  (useLocalSearchParams as jest.Mock).mockReturnValue({});
  renderWithData = setupFeatureTest();
});

describe('Filtros', () => {
  it('shows every section and a live "Ver N eventos" count that follows the selection', async () => {
    await renderWithData(<FiltrosScreen />);
    for (const t of ['Gênero', 'Região', 'Preço', 'Distância', 'Data', 'Artista']) {
      expect(screen.getByText(t)).toBeOnTheScreen();
    }
    const all = await screen.findByText(/^Ver \d+ eventos$/);
    const total = Number(all.props.children.toString().match(/\d+/)![0]);
    expect(total).toBeGreaterThan(2);
    await fireEvent.press(screen.getByRole('button', { name: 'Funk' }));
    expect(useFilters.getState().filters.genreSlugs).toEqual(['funk']);
    expect(await screen.findByText('Ver 2 eventos')).toBeOnTheScreen();
  });

  it('price steps, radius and date chips write to the store; Limpar resets', async () => {
    await renderWithData(<FiltrosScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Grátis' }));
    expect(useFilters.getState().filters.priceMax).toBe(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Até R$ 40' }));
    expect(useFilters.getState().filters.priceMax).toBe(40);
    await fireEvent.press(screen.getByRole('button', { name: '3 km' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Hoje' }));
    expect(useFilters.getState().filters.radiusKm).toBe(3);
    expect(useFilters.getState().filters.dateRange).toBe('hoje');
    await fireEvent.press(screen.getByRole('button', { name: 'Limpar' }));
    expect(useFilters.getState().filters.priceMax).toBeNull();
    expect(useFilters.getState().filters.radiusKm).toBe(10);
  });

  it('artist search selects a result into the store', async () => {
    await renderWithData(<FiltrosScreen />);
    await fireEvent.changeText(screen.getByTestId('artist-search'), 'ana');
    await fireEvent.press(await screen.findByTestId('artist-a5'));
    expect(useFilters.getState().filters.artistId).toBe('a5');
  });

  it('hydrates the store from deep-link params (URL codec round trip)', async () => {
    const want = { ...urlParamsToFilters({}), genreSlugs: ['rock'], priceMax: 20, radiusKm: 5 as const, dateRange: 'hoje' as const };
    const params = filtersToUrlParams(want);
    expect(urlParamsToFilters(params)).toEqual(want);
    (useLocalSearchParams as jest.Mock).mockReturnValue(params);
    await renderWithData(<FiltrosScreen />);
    expect(useFilters.getState().filters).toEqual(want);
    expect(await screen.findByRole('button', { name: 'Rock' })).toBeOnTheScreen();
  });
  it('"Vibe & acesso" chips toggle tags and narrow the live count', async () => {
    await renderWithData(<FiltrosScreen />);
    expect(screen.getByText('Vibe & acesso')).toBeOnTheScreen();
    const all = await screen.findByText(/^Ver \d+ eventos$/);
    const total = Number(all.props.children.toString().match(/\d+/)![0]);
    await fireEvent.press(screen.getByRole('button', { name: 'Acessível' }));
    expect(useFilters.getState().filters.tags).toEqual(['acessivel']);
    await waitFor(() => {
      const narrowed = screen.getByText(/^Ver \d+ eventos?$/);
      expect(Number(narrowed.props.children.toString().match(/\d+/)![0])).toBeLessThan(total);
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Acessível' }));
    expect(useFilters.getState().filters.tags).toEqual([]);
  });
});

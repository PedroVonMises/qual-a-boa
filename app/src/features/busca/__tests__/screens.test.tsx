import '@/ui/testSetup';
import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { ExplorarScreen } from '@/features/explorar/ExplorarScreen';
import { setupFeatureTest } from '@/features/explorar/testUtils';
import { PrivacidadeScreen } from '@/features/privacidade';
import { QuandoSheet } from '@/features/quando';
import { OfflineBanner } from '@/shell/OfflineBanner';
import { useFilters } from '@/state/filters';
import { useSearchHistory } from '@/state/searchHistory';
import { useSession } from '@/state/session';
import { BuscaScreen } from '../BuscaScreen';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  useRouter: () => ({ push: mockPush, back: mockBack, replace: mockReplace, canGoBack: () => true }),
  useLocalSearchParams: jest.fn(() => ({})),
}));

let renderWithData: ReturnType<typeof setupFeatureTest>;
beforeEach(() => {
  jest.clearAllMocks();
  renderWithData = setupFeatureTest();
  useSearchHistory.setState({ recent: [] });
});

describe('Busca', () => {
  it('groups venues, events and artists and filters by kind', async () => {
    await renderWithData(<BuscaScreen initialQuery="selva" />);
    expect(await screen.findByTestId('busca-venue-selva')).toBeOnTheScreen();
    expect((await screen.findAllByText(/Pagode da Selva/)).length).toBeGreaterThan(0);
    expect(screen.getByText('CASAS')).toBeOnTheScreen();
    expect(screen.getByText('EVENTOS')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('busca-kind-casas'));
    expect(screen.queryByText('EVENTOS')).toBeNull();
    await fireEvent.press(screen.getByTestId('busca-venue-selva'));
    expect(router.push).toHaveBeenCalledWith('/casa/selva');
    expect(useSearchHistory.getState().recent).toEqual(['selva']);
  });

  it('finds artists', async () => {
    await renderWithData(<BuscaScreen initialQuery="grupo sol" />);
    await fireEvent.press(await screen.findByTestId('busca-artist-grupo-sol'));
    expect(router.push).toHaveBeenCalledWith('/artista/grupo-sol');
  });

  it('shows a specific empty state', async () => {
    await renderWithData(<BuscaScreen initialQuery="zzzzz" />);
    expect(await screen.findByText('Nada encontrado')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Abrir filtros' }));
    expect(router.push).toHaveBeenCalledWith('/filtros');
  });

  it('lists, reuses, removes and clears recent searches', async () => {
    useSearchHistory.setState({ recent: ['selva', 'funk'] });
    await renderWithData(<BuscaScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Remover funk das buscas recentes' }));
    expect(useSearchHistory.getState().recent).toEqual(['selva']);
    await fireEvent.press(screen.getByTestId('busca-recent-0'));
    expect(await screen.findByTestId('busca-venue-selva')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId('busca-input'), '');
    await fireEvent.press(await screen.findByTestId('busca-clear-history'));
    expect(useSearchHistory.getState().recent).toEqual([]);
    expect(screen.getByTestId('busca-hint')).toBeOnTheScreen();
  });

  it('Explorar: submitting the search opens Busca, and a typed query offers venues and artists', async () => {
    await renderWithData(<ExplorarScreen />);
    const input = await screen.findByTestId('search-input');
    await fireEvent.changeText(input, 'selva');
    await fireEvent(input, 'submitEditing');
    expect(router.push).toHaveBeenCalledWith({ pathname: '/busca', params: { q: 'selva' } });
    expect(useSearchHistory.getState().recent).toEqual(['selva']);
    await waitFor(() => expect(useFilters.getState().filters.query).toBe('selva'));
    await fireEvent.press(await screen.findByTestId('search-all'));
    expect(router.push).toHaveBeenLastCalledWith({ pathname: '/busca', params: { q: 'selva' } });
  });
});

describe('Quando', () => {
  it('quick range applies to the filters', async () => {
    const onClose = jest.fn();
    await renderWithData(<QuandoSheet visible onClose={onClose} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Amanhã' }));
    await fireEvent.press(screen.getByTestId('quando-apply'));
    expect(useFilters.getState().filters.dateRange).toBe('amanha');
    expect(onClose).toHaveBeenCalled();
  });

  it('picks a range of nights on the calendar; past days are disabled', async () => {
    await renderWithData(<QuandoSheet visible onClose={jest.fn()} />);
    expect(screen.getByTestId('quando-month')).toHaveTextContent('Outubro 2026');
    expect(screen.getByRole('button', { name: 'quinta, 22 de outubro' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'sexta, 23 de outubro, hoje' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('quando-day-24'));
    await fireEvent.press(screen.getByTestId('quando-day-25'));
    expect(screen.getByTestId('quando-summary')).toHaveTextContent(/sáb 24 – dom 25 out/);
    await fireEvent.press(screen.getByTestId('quando-apply'));
    expect(useFilters.getState().filters).toMatchObject({ dateRange: 'datas', days: { from: '2026-10-24', to: '2026-10-25' } });
  });

  it('limpar resets the draft to any day', async () => {
    useFilters.getState().set({ dateRange: 'hoje' });
    await renderWithData(<QuandoSheet visible onClose={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('quando-clear'));
    await fireEvent.press(screen.getByTestId('quando-apply'));
    expect(useFilters.getState().filters.dateRange).toBe('qualquer');
  });

  it('Explorar date pill opens the sheet and shows the active range', async () => {
    useFilters.getState().set({ dateRange: 'fim-de-semana' });
    await renderWithData(<ExplorarScreen />);
    const pill = await screen.findByTestId('date-chip');
    expect(pill).toHaveTextContent(/Fim de semana/);
    await fireEvent.press(pill);
    expect(await screen.findByTestId('quando-sheet')).toBeOnTheScreen();
  });
});

describe('Privacidade', () => {
  it('clears recent searches and wipes device data after confirmation', async () => {
    useSearchHistory.setState({ recent: ['selva'] });
    useSession.setState({ ageConfirmed: true, onboardingDone: true });
    await renderWithData(<PrivacidadeScreen />);
    expect(screen.getByText('1 busca guardada')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('privacidade-clear-history'));
    expect(useSearchHistory.getState().recent).toEqual([]);
    expect(screen.getByTestId('privacidade-done')).toHaveTextContent('Buscas recentes apagadas.');

    await fireEvent.press(screen.getByTestId('privacidade-wipe'));
    await fireEvent.press(await screen.findByTestId('privacidade-wipe-yes'));
    expect(useSession.getState().ageConfirmed).toBe(false);
    expect(mockReplace).toHaveBeenCalledWith('/onboarding/idade');
  });

  it('links to event alerts and opens the privacy policy draft', async () => {
    await renderWithData(<PrivacidadeScreen />);
    await fireEvent.press(screen.getByTestId('privacidade-avisos'));
    expect(mockPush).toHaveBeenCalledWith('/acompanhar');
    await fireEvent.press(screen.getByRole('button', { name: 'Política de privacidade' }));
    expect(await screen.findByText('rascunho')).toBeTruthy();
  });
});

describe('OfflineBanner', () => {
  afterEach(() => onlineManager.setOnline(true));
  it('appears only while offline', async () => {
    await renderWithData(<OfflineBanner />);
    expect(screen.queryByTestId('offline-banner')).toBeNull();
    await act(async () => onlineManager.setOnline(false));
    expect(screen.getByTestId('offline-banner')).toHaveTextContent(/Sem internet/);
    await act(async () => onlineManager.setOnline(true));
    expect(screen.queryByTestId('offline-banner')).toBeNull();
  });
});

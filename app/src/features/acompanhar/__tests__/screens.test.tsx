import '@/ui/testSetup';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { setRepo, SeedRepo } from '@/data';
import { miniDataset, MINI_NOW } from '@/data/__fixtures__/mini';
import type { SeedDataset } from '@/domain/types';
import { AoVivoScreen } from '@/features/aoVivo/AoVivoScreen';
import { useCheckins } from '@/state/checkins';
import { useFavorites } from '@/state/favorites';
import { emptyFollows, useFollows } from '@/state/follows';
import { useLive } from '@/state/live';
import { AcompanharScreen } from '../AcompanharScreen';
import { AvisosScreen } from '../AvisosScreen';
import { setNowForTests } from '../useNow';

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: mockReplace, canGoBack: () => true }),
}));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(() => Promise.resolve({ type: 'opened' })) }));
jest.mock('expo-linking', () => ({ createURL: (p: string) => `qualaboa://${p}`, openURL: jest.fn(() => Promise.resolve(true)) }));

// v1 is the fictional Casa Maré in these tests (e01); v3 is a real venue (e03).
const data: SeedDataset = {
  ...miniDataset,
  venues: miniDataset.venues.map((v) => (v.id === 'v1' ? { ...v, slug: 'casa-mare', name: 'Casa Maré' } : v)),
};

async function renderWith(ui: React.ReactElement) {
  setRepo(new SeedRepo(data, () => Date.parse(MINI_NOW)));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  setNowForTests(() => Date.parse(MINI_NOW));
  useFollows.setState({ ...emptyFollows });
  useFavorites.setState({ eventIds: [], venueIds: [], artistSlugs: [] });
  useCheckins.setState({ checkins: [] });
  useLive.setState({ reports: [] });
});
afterEach(() => setNowForTests());

describe('Acompanhar', () => {
  it('shows an empty state and lets saved events be followed', async () => {
    useFavorites.setState({ eventIds: ['e03'] });
    await renderWith(<AcompanharScreen />);
    expect(await screen.findByText('Você ainda não acompanha nenhum evento')).toBeTruthy();
    await fireEvent.press(await screen.findByLabelText('Acompanhar Rock na Praia'));
    expect(useFollows.getState().isFollowing('e03')).toBe(true);
    expect(await screen.findByLabelText(/^Salvo, feito/)).toBeTruthy();
  });

  it('renders timeline with text status, countdown, and toggles the ticket', async () => {
    useFollows.getState().follow('e03', MINI_NOW);
    await renderWith(<AcompanharScreen />);
    expect(await screen.findByText('Rock na Praia')).toBeTruthy();
    expect(screen.getByText('1 d 10 h')).toBeTruthy();
    expect(screen.getByText('para começar')).toBeTruthy();
    expect(screen.getByLabelText(/^Salvo, feito/)).toBeTruthy();
    expect(screen.getByLabelText(/^Ingresso, agora/)).toBeTruthy();
    expect(screen.getByLabelText(/^Dia do evento, a seguir/)).toBeTruthy();
    expect(screen.getByLabelText(/^Avaliar, a seguir/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Já tenho ingresso'));
    expect(useFollows.getState().follows.e03.hasTicket).toBe(true);
    expect(screen.getByLabelText(/^Ingresso, feito/)).toBeTruthy();
    // Real venue: no invented change feed.
    expect(useFollows.getState().changes).toHaveLength(0);
  });

  it('seeds untagged demo changes only for Casa Maré and marks them read on tap', async () => {
    useFollows.getState().follow('e01', MINI_NOW);
    await renderWith(<AcompanharScreen />);
    expect(await screen.findByText('Atração nova: Taís Mar')).toBeTruthy();
    expect(screen.queryByText(/ilustrativ/i)).toBeNull();
    expect(screen.getAllByText('Nova')).toHaveLength(3);
    expect(screen.getByText('3 não lidas')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('change-demo-e01-2'));
    expect(screen.getAllByText('Nova')).toHaveLength(2);
    await fireEvent.press(screen.getByText('Marcar como lidas'));
    expect(screen.queryAllByText('Nova')).toHaveLength(0);
    expect(screen.getByText('Tudo lido.')).toBeTruthy();
  });
});

describe('Avisos', () => {
  it('toggles alerts and channels into the store, and unfollows', async () => {
    useFollows.getState().follow('e03', MINI_NOW);
    await renderWith(<AvisosScreen eventId="e03" />);
    const price = await screen.findByLabelText('Mudar o preço ou virar o lote');
    expect(price.props.accessibilityState.checked).toBe(true);
    await fireEvent.press(price);
    expect(useFollows.getState().follows.e03.alerts.price).toBe(false);
    await fireEvent.press(screen.getByLabelText('E-mail'));
    expect(useFollows.getState().follows.e03.channels.email).toBe(true);
    await fireEvent.press(screen.getByText('Parar de acompanhar este evento'));
    expect(useFollows.getState().isFollowing('e03')).toBe(false);
  });

  it('is empty when no event is followed', async () => {
    await renderWith(<AvisosScreen />);
    expect(await screen.findByText('Nenhum evento para configurar')).toBeTruthy();
  });
});

describe('Ao vivo', () => {
  it('real venue: honest empty state, no reports invented, reporting locked until check-in', async () => {
    await renderWith(<AoVivoScreen id="e03" />);
    expect(await screen.findByText('Rock na Praia')).toBeTruthy();
    expect(screen.getAllByText('Ainda sem relatos')).toHaveLength(4);
    expect(screen.getByText(/Ainda sem relatos para este evento/)).toBeTruthy();
    expect(screen.queryByText(/ilustrativ/i)).toBeNull();
    expect(screen.getByLabelText('Relatar agora').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByLabelText('Documento com foto (18+)')).toBeTruthy();
  });

  it('check-in unlocks the quick report, whose result shows with sample size', async () => {
    await renderWith(<AoVivoScreen id="e03" />);
    await fireEvent.press(await screen.findByText('Estou aqui'));
    expect(useCheckins.getState().hasCheckedIn('e03')).toBe(true);
    expect(await screen.findByText('Você está aqui')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Relatar agora'));
    await fireEvent.press(await screen.findByLabelText('Curta'));
    await fireEvent.changeText(screen.getByLabelText('Preço na porta em reais'), '35');
    await fireEvent.press(screen.getByText('Enviar relato'));
    expect(useLive.getState().reports).toHaveLength(1);
    expect(useLive.getState().reports[0]).toMatchObject({ eventId: 'e03', queue: 'short', priceAtDoor: 35 });
    expect(await screen.findByText('Relato enviado. Obrigado por ajudar quem está chegando.')).toBeTruthy();
    expect(screen.getByText(/Relato de 1 pessoa/)).toBeTruthy();
    expect(screen.getByText(/^R\$\s*35/)).toBeTruthy();
  });

  it('Casa Maré shows example reports without any tag with sample size and age', async () => {
    await renderWith(<AoVivoScreen id="e01" />);
    expect(await screen.findByText(/Relatos de 14 pessoas, o último há 12 min/)).toBeTruthy();
    expect(screen.getByText('Casa Maré')).toBeTruthy();
    expect(screen.queryByText(/ilustrativ/i)).toBeNull();
    expect(screen.getByText('Cheia')).toBeTruthy();
    expect(screen.getByText('5 de 5')).toBeTruthy();
  });

  it('marks own old reports as stale', async () => {
    useLive.setState({
      reports: [{ id: 'old', eventId: 'e03', at: new Date(Date.parse(MINI_NOW) - 3 * 3600_000).toISOString(), queue: 'long' }],
    });
    await renderWith(<AoVivoScreen id="e03" />);
    expect(await screen.findByText('Desatualizado')).toBeTruthy();
    expect(screen.getByText(/Sem relatos recentes/)).toBeTruthy();
  });
});

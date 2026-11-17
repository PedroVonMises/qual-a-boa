import '@/ui/testSetup';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Linking from 'expo-linking';

import { setRepo, SeedRepo } from '@/data';
import { miniDataset, MINI_NOW } from '@/data/__fixtures__/mini';
import { useSupport } from '@/state/support';
import { RelatoScreen } from '../RelatoScreen';

const mockReplace = jest.fn();
jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: mockReplace, canGoBack: () => true }),
}));
jest.mock('expo-linking', () => ({ openURL: jest.fn(() => Promise.resolve(true)), createURL: (p: string) => p }));

const venue = miniDataset.venues[0];
const event = miniDataset.events.find((e) => e.venueId === venue.id)!;

async function show(ui: React.ReactElement) {
  setRepo(new SeedRepo(miniDataset, () => Date.parse(MINI_NOW)));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  useSupport.setState({ tickets: [], unsynced: [], remoteIds: {} });
});

describe('Aconteceu algo comigo (S3)', () => {
  it('calls 190 and 180 with one tap', async () => {
    await show(<RelatoScreen slug={venue.slug} />);
    await fireEvent.press(screen.getByTestId('ligar-190'));
    await fireEvent.press(screen.getByTestId('ligar-180'));
    expect(Linking.openURL).toHaveBeenNthCalledWith(1, 'tel:190');
    expect(Linking.openURL).toHaveBeenNthCalledWith(2, 'tel:180');
  });

  it('needs the kind and a description, then opens a private seguranca conversation', async () => {
    await show(<RelatoScreen slug={venue.slug} eventId={event.id} />);
    expect(await screen.findByTestId('relato-onde')).toHaveTextContent(`${event.title} · ${venue.name}`);
    expect(screen.getByText(/nunca é publicado e a casa não fica sabendo quem relatou/)).toBeTruthy();

    await fireEvent.press(screen.getByTestId('relato-enviar'));
    expect(screen.getByText('Escolha o que aconteceu.')).toBeTruthy();
    expect(useSupport.getState().tickets).toHaveLength(0);

    await fireEvent.press(screen.getByTestId('relato-tipo-importunacao'));
    await fireEvent.changeText(screen.getByTestId('relato-texto'), 'Um cara me agarrou na pista e a equipe demorou.');
    await fireEvent.press(screen.getByTestId('relato-enviar'));

    const [t] = useSupport.getState().tickets;
    expect(t).toMatchObject({ topic: 'seguranca', eventId: event.id, safety: { venueId: venue.id, kind: 'importunacao' } });
    expect(t.description).toBe(`[${event.title}, ${venue.name}] Um cara me agarrou na pista e a equipe demorou.`);
    expect(mockReplace).toHaveBeenCalledWith(`/ajuda/suporte/${t.id}`);
  });

  it('an event from another venue is ignored; an unknown venue cannot be reported', async () => {
    const other = miniDataset.events.find((e) => e.venueId !== venue.id)!;
    await show(<RelatoScreen slug={venue.slug} eventId={other.id} />);
    expect(await screen.findByTestId('relato-onde')).toHaveTextContent(venue.name);
    expect(screen.getByTestId('relato-onde')).not.toHaveTextContent(other.title);
  });

  it('unknown venue', async () => {
    await show(<RelatoScreen slug="nada" />);
    expect(await screen.findByText(/Não encontramos a casa deste relato/)).toBeTruthy();
    expect(screen.getByTestId('ligar-190')).toBeTruthy();
  });
});

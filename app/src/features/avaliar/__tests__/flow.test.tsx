import '@/ui/testSetup';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { setRepo, SeedRepo } from '@/data';
import { miniDataset, MINI_NOW } from '@/data/__fixtures__/mini';
import type { SeedDataset } from '@/domain/types';
import { AvaliacoesScreen } from '@/features/avaliacoes/AvaliacoesScreen';
import { setCheckinLookup, useReviews } from '@/state/reviews';
import { useDraft } from '../draft';
import { AvaliarScreen } from '../AvaliarScreen';
import { TextoScreen } from '../TextoScreen';

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: mockReplace, canGoBack: () => true }),
}));

// First venue plays the fictional Casa Maré; the second is a "real" venue.
const data: SeedDataset = {
  ...miniDataset,
  venues: miniDataset.venues.map((v, i) => (i === 0 ? { ...v, slug: 'casa-mare', name: 'Casa Maré' } : v)),
};
const demoEvent = data.events.find((e) => e.venueId === data.venues[0].id)!;
const realEvent = data.events.find((e) => e.venueId === data.venues[1].id)!;

async function renderWith(ui: React.ReactElement) {
  setRepo(new SeedRepo(data, () => Date.parse(MINI_NOW)));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  setCheckinLookup(undefined);
  useDraft.getState().clear();
  useReviews.setState({ mine: [], helpfulIds: [], reportedIds: [] });
});

describe('Avaliar step 1', () => {
  it('rating is a radiogroup of >=44px radios and blocks Continuar without a score', async () => {
    await renderWith(<AvaliarScreen id={demoEvent.id} />);
    const radios = await screen.findAllByRole('radio', { name: /estrela/ });
    expect(radios).toHaveLength(5);
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText(/Escolha uma nota/)).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('radio', { name: '4 estrelas' }));
    expect(screen.getByText('4 de 5 · Muito bom')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
    expect(mockPush).toHaveBeenCalledWith(`/avaliar/${demoEvent.id}/texto`);
  });

  it('topic scores set and clear, tags toggle', async () => {
    await renderWith(<AvaliarScreen id={demoEvent.id} />);
    await fireEvent.press(await screen.findByRole('radio', { name: 'Som, nota 5' }));
    expect(useDraft.getState().topics.musica).toBe(5);
    await fireEvent.press(screen.getByRole('radio', { name: 'Som, nota 5' }));
    expect(useDraft.getState().topics.musica).toBeUndefined();
    await fireEvent.press(screen.getByRole('button', { name: 'Música boa' }));
    expect(useDraft.getState().tags).toEqual(['Música boa']);
  });
});

describe('Avaliar step 2 and submit', () => {
  it('redirects to step 1 when there is no rating', async () => {
    await render(<TextoScreen id={demoEvent.id} />);
    expect(screen.getByText('Falta a sua nota')).toBeTruthy();
  });

  it('limits and counts the text, rejects personal data, then submits a pending review', async () => {
    setCheckinLookup(() => true);
    useDraft.getState().open(demoEvent.id, { rating: 5 });
    await render(<TextoScreen id={demoEvent.id} />);
    const input = screen.getByLabelText('Sua avaliação');
    expect(input.props.maxLength).toBe(800);
    expect(screen.getByRole('button', { name: 'Adicionar foto, em breve' })).toBeTruthy();

    await fireEvent.changeText(input, 'Escreva para joao@mail.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar avaliação' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(useReviews.getState().mine).toHaveLength(0);

    await fireEvent.changeText(input, 'Som muito bom');
    expect(screen.getByText('13/800')).toBeTruthy();
    await fireEvent.press(screen.getByRole('switch', { name: 'Publicar sem meu nome' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Enviar avaliação' }));

    const [r] = useReviews.getState().mine;
    expect(r).toMatchObject({ eventId: demoEvent.id, rating: 5, text: 'Som muito bom', anonymous: true, status: 'pending', attended: true });
    expect(mockReplace).toHaveBeenCalledWith(`/avaliacoes/${demoEvent.id}?enviada=1`);
    expect(useDraft.getState().rating).toBe(0);
  });

  it('Pular sends the rating without text', async () => {
    useDraft.getState().open(demoEvent.id, { rating: 3, text: 'rascunho' });
    await render(<TextoScreen id={demoEvent.id} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Pular' }));
    expect(useReviews.getState().mine[0].text).toBeUndefined();
  });
});

describe('Avaliações', () => {
  it('shows labeled demo reviews for Casa Maré with stats, helpful and report', async () => {
    await renderWith(<AvaliacoesScreen id={demoEvent.id} />);
    expect(await screen.findAllByText('Exemplo ilustrativo')).toHaveLength(3);
    expect(screen.getByText('3 avaliações')).toBeTruthy();
    expect(screen.getAllByText('Foi ao evento').length).toBe(2);
    expect(screen.getByRole('progressbar', { name: /Som, 5 de 5/ })).toBeTruthy();

    await fireEvent.press(screen.getByTestId('util-demo-1'));
    expect(useReviews.getState().isHelpful('demo-1')).toBe(true);
    expect(screen.getByRole('button', { name: 'Útil, 13' })).toBeTruthy();
    await fireEvent.press(screen.getByTestId('denunciar-demo-1'));
    expect(screen.getByRole('button', { name: 'Denúncia enviada' })).toBeTruthy();
  });

  it('shows an honest empty state for real venues (no invented reviews)', async () => {
    await renderWith(<AvaliacoesScreen id={realEvent.id} />);
    expect(await screen.findByText('Ainda sem avaliações')).toBeTruthy();
    expect(screen.queryByText('Exemplo ilustrativo')).toBeNull();
  });

  it('shows the author review as Em análise plus the sent notice', async () => {
    useReviews.getState().submitReview({ eventId: realEvent.id, rating: 4, text: 'Gostei' });
    await renderWith(<AvaliacoesScreen id={realEvent.id} sent />);
    expect(await screen.findByText('Em análise')).toBeTruthy();
    expect(screen.getByText('Avaliação enviada')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Editar minha avaliação' })).toBeTruthy();
    expect(screen.queryByText('Ainda sem avaliações')).toBeNull();
  });
});

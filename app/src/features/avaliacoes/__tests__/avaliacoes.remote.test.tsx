import '@/ui/testSetup';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { SeedRepo, setRepo } from '@/data';
import { MINI_NOW, miniDataset } from '@/data/__fixtures__/mini';
import { setSupabase } from '@/data/supabaseClient';
import { fakeSupabase, type Call } from '@/data/sync/fakeSupabase';
import { useReviews } from '@/state/reviews';
import { AvaliacoesScreen } from '../AvaliacoesScreen';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/env', () => ({
  env: { dataSource: 'supabase', supabaseUrl: 'http://x', supabaseAnonKey: 'k', demoTools: false },
}));

const EVENT_ID = '11111111-1111-4111-8111-111111111111';
const dataset = {
  ...miniDataset,
  events: miniDataset.events.map((e, i) => (i === 0 ? { ...e, id: EVENT_ID } : e)),
};

const row = (over: Record<string, unknown>) => ({
  id: 'r0',
  event_id: EVENT_ID,
  rating: 5,
  topics: { musica: 5 },
  tags: [],
  text: null,
  anonymous: false,
  attended: true,
  status: 'published',
  helpful_count: 0,
  created_at: '2026-10-22T12:00:00.000Z',
  mine: false,
  ...over,
});

const wrap = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <AvaliacoesScreen id={EVENT_ID} />
    </QueryClientProvider>,
  );

const feed = (respond: (c: Call) => { data?: unknown; error?: { message: string } | null }) =>
  setSupabase(fakeSupabase((c) => (c.table === 'reviews_feed' ? respond(c) : undefined)).client);

beforeEach(() => {
  setRepo(new SeedRepo(dataset, () => Date.parse(MINI_NOW)));
  useReviews.setState({ mine: [], helpfulIds: [], reportedIds: [], reportSentIds: [] });
});
afterEach(() => setSupabase(null));

describe('Avaliações with the backend on', () => {
  it('shows other people\'s published reviews from reviews_feed and their stats', async () => {
    feed(() => ({
      data: [
        row({ id: 'a', text: 'Noite incrível', rating: 5 }),
        row({ id: 'b', text: 'Fila enorme', rating: 2 }),
        row({ id: 'c', text: 'Ainda em análise', status: 'pending' }),
      ],
    }));
    await wrap();
    expect(await screen.findByText('Noite incrível')).toBeTruthy();
    expect(screen.getByText('Fila enorme')).toBeTruthy();
    // Another person's pending row must never show.
    expect(screen.queryByText('Ainda em análise')).toBeNull();
    expect(screen.getByText('2 avaliações')).toBeTruthy();
  });

  it('shows an empty state when nobody has reviewed yet', async () => {
    feed(() => ({ data: [] }));
    await wrap();
    expect(await screen.findByText('Ainda sem avaliações')).toBeTruthy();
  });

  it('keeps the author\'s own review on top with its moderation state', async () => {
    feed(() => ({
      data: [row({ id: 'a', text: 'De outra pessoa' }), row({ id: 'm', text: 'Minha', mine: true, status: 'pending' })],
    }));
    await wrap();
    // `mine` is adopted into the store a tick before the query result renders the others, so await both.
    expect(await screen.findByText('De outra pessoa')).toBeTruthy();
    expect(await screen.findByText('Minha')).toBeTruthy();
    expect(screen.getByText('Em análise')).toBeTruthy();
  });

  it('flags a review the moderation removed', async () => {
    feed(() => ({ data: [row({ id: 'm', text: 'Minha', mine: true, status: 'hidden' })] }));
    await wrap();
    expect(await screen.findByText('Removida pela moderação')).toBeTruthy();
  });

  it('offers a retry when the feed fails, and recovers', async () => {
    let fail = true;
    feed(() => (fail ? { error: { message: 'boom' } } : { data: [row({ id: 'a', text: 'Voltou' })] }));
    await wrap();
    expect(await screen.findByText(/Não foi possível carregar as avaliações/)).toBeTruthy();
    fail = false;
    await fireEvent.press(screen.getByTestId('avaliacoes-retry'));
    expect(await screen.findByText('Voltou')).toBeTruthy();
  });
});

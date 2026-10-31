import '@/ui/testSetup';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { fakeClient, type Call, type Handler } from '@/data/sync/fakeClient';
import type { ThreadFeedRow } from '@/data/sync/community';
import { COMMUNITY_PAGE_SIZE } from '@/domain/community';
import { useCommunity } from '@/state/community';
import { useFollows } from '@/state/follows';
import { FeedScreen } from '../FeedScreen';

let mockClient: unknown = null;
jest.mock('@/data/supabaseClient', () => ({
  isRemote: () => true,
  getSupabase: () => mockClient,
  ensureUserId: async () => null, // signed out: pushes stay local, reads still work (the feed views are public)
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const N = COMMUNITY_PAGE_SIZE;
const EV = '11111111-1111-4111-8111-111111111111';

const rowAt = (i: number): ThreadFeedRow => ({
  id: `00000000-0000-4000-8000-${String(i + 1000).padStart(12, '0')}`,
  event_id: EV,
  venue_id: null,
  event_name: 'Noite do Pagodão',
  venue_slug: 'casa-mare',
  kind: 'vale_a_pena',
  title: `Pergunta ${i}`,
  body: null,
  anonymous: true,
  handle: null,
  avatar_hue: null,
  status: 'published',
  comment_count: 2,
  created_at: new Date(Date.parse('2026-10-30T20:00:00Z') - i * 60_000).toISOString(),
  mine: false,
  archived: false,
  top_comment_id: null,
  top_comment_body: null,
  top_comment_votes: null,
  uf: 'ES',
});
const rows = (from: number, count: number) => Array.from({ length: count }, (_, k) => rowAt(from + k));
const isNextPage = (c: Call) => c.filters.some((f) => f[1] === 'or');

function use(handler: Handler) {
  const f = fakeClient(handler);
  mockClient = f.client;
  return f.calls;
}
const wrap = () => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
    <FeedScreen />
  </QueryClientProvider>
);

beforeEach(() => {
  useCommunity.setState({ handle: undefined, threads: [], comments: [], votedIds: [], reportedIds: [], reportSentIds: [], aliases: {}, handleTaken: false });
  useFollows.setState({ follows: {} });
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('FeedScreen (backend on)', () => {
  it('shows skeletons on the first load, then the threads', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => (release = r));
    use(async () => {
      await gate;
      return { data: rows(0, 3) };
    });
    await render(wrap());
    expect(screen.getByTestId('comunidade-loading')).toBeTruthy();
    expect(screen.queryByText('Nada por aqui ainda')).toBeNull(); // loading is not "empty"
    release();
    await screen.findByRole('button', { name: /^Pergunta 0\./ });
    expect(screen.queryByTestId('comunidade-loading')).toBeNull();
  });

  it('shows an error with retry on the first load, not an empty state', async () => {
    let fail = true;
    use(() => (fail ? { error: { code: '57014', message: 'timeout' } } : { data: rows(0, 2) }));
    await render(wrap());
    await screen.findByText('Não deu pra carregar');
    expect(screen.queryByText('Nada por aqui ainda')).toBeNull();
    fail = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));
    await screen.findByRole('button', { name: /^Pergunta 0\./ });
  });

  it('keeps the list and offers an inline retry when the next page fails', async () => {
    let failNext = true;
    const calls = use((c) =>
      isNextPage(c) ? (failNext ? { error: { code: '57014', message: 'timeout' } } : { data: rows(N, 4) }) : { data: rows(0, N + 1) },
    );
    await render(wrap());
    await screen.findByRole('button', { name: /^Pergunta 0\./ });

    await fireEvent(screen.getByTestId('comunidade-list'), 'endReached');
    await screen.findByTestId('comunidade-next-error');
    expect(screen.getByRole('button', { name: /^Pergunta 0\./ })).toBeTruthy(); // still there
    expect(calls.filter(isNextPage)).toHaveLength(1);

    failNext = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));
    await screen.findByTestId('comunidade-end');
  });

  it('asks the server only for the chosen state', async () => {
    const calls = use(() => ({ data: rows(0, 2) }));
    await render(wrap());
    await screen.findByRole('button', { name: /^Pergunta 0\./ });
    const feedCalls = calls.filter((c) => c.table === 'threads_feed');
    expect(feedCalls.length).toBeGreaterThan(0);
    for (const c of feedCalls) expect(c.filters).toContainEqual(['uf', 'eq', 'ES']);
  });

  it('does not ask for a next page while on the last one', async () => {
    const calls = use(() => ({ data: rows(0, 3) }));
    await render(wrap());
    await screen.findByTestId('comunidade-end');
    await fireEvent(screen.getByTestId('comunidade-list'), 'endReached');
    expect(calls.filter(isNextPage)).toHaveLength(0);
  });

  it('puts this device\'s new thread on top without waiting for the server', async () => {
    use(() => ({ data: rows(0, 3) }));
    await render(wrap());
    await screen.findByRole('button', { name: /^Pergunta 0\./ });
    await act(async () => {
      useCommunity.getState().createThread({ eventId: EV, eventName: 'Noite do Pagodão', kind: 'grupo', title: 'Minha pergunta', anonymous: true });
    });
    expect(screen.getByRole('button', { name: /^Minha pergunta\./ })).toBeTruthy();
  });

  it('"Seguindo" with no followed events makes no request for that scope', async () => {
    const calls = use(() => ({ data: rows(0, 3) }));
    await render(wrap());
    await screen.findByRole('button', { name: /^Pergunta 0\./ });
    const before = calls.length;
    await fireEvent.press(screen.getByRole('tab', { name: 'Seguindo' }));
    await screen.findByText('Nenhuma conversa seguida');
    expect(calls.length).toBe(before);
  });
});

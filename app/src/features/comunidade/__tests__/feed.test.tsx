import '@/ui/testSetup';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { COMMUNITY_PAGE_SIZE, type ThreadQuery } from '@/domain/community';
import { useCommunity } from '@/state/community';
import { useFollows } from '@/state/follows';
import { FeedScreen } from '../FeedScreen';
import { useThreads } from '../hooks';

const mockEnv = { demoThreads: 60, dataSource: 'seed', supabaseUrl: '', supabaseAnonKey: '', demoTools: true, appEnv: 'test', feedUrl: '' };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/env', () => ({
  get env() {
    return mockEnv;
  },
}));

const N = COMMUNITY_PAGE_SIZE;
const TOTAL = 63; // 60 synthetic + 3 demo threads

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
const wrap = (ui: React.ReactElement) => <QueryClientProvider client={client()}>{ui}</QueryClientProvider>;

beforeEach(() => {
  mockEnv.demoThreads = 60;
  useCommunity.setState({ handle: undefined, threads: [], comments: [], votedIds: [], reportedIds: [], reportSentIds: [], aliases: {}, handleTaken: false });
  useFollows.setState({ follows: {} });
});

function Probe({ q }: { q: ThreadQuery }) {
  const feed = useThreads(q);
  return (
    <>
      <Text testID="state">{`${feed.items.length}|${feed.hasNextPage}|${feed.items[0]?.id ?? '-'}`}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="mais" onPress={feed.fetchNextPage}>
        <Text>mais</Text>
      </Pressable>
    </>
  );
}
const state = () => screen.getByTestId('state').props.children as string;
const more = () => fireEvent.press(screen.getByRole('button', { name: 'mais' }));

describe('useThreads (local mode)', () => {
  const FEED: ThreadQuery = { scope: 'all', sort: 'recent' };

  it('shows one page, then grows a page at a time until the list ends', async () => {
    await render(wrap(<Probe q={FEED} />));
    expect(state().startsWith(`${N}|true`)).toBe(true);
    await more();
    expect(state().startsWith(`${2 * N}|true`)).toBe(true);
    await more();
    expect(state().startsWith(`${3 * N}|true`)).toBe(true);
    await more();
    expect(state().startsWith(`${TOTAL}|false`)).toBe(true);
    await more(); // past the end: nothing changes
    expect(state().startsWith(`${TOTAL}|false`)).toBe(true);
  });

  it('orders newest first with no duplicates across pages', async () => {
    const ids: string[] = [];
    function Collect() {
      const feed = useThreads(FEED);
      ids.splice(0, ids.length, ...feed.items.map((t) => t.id));
      return (
        <Pressable accessibilityRole="button" accessibilityLabel="mais" onPress={feed.fetchNextPage}>
          <Text>mais</Text>
        </Pressable>
      );
    }
    await render(wrap(<Collect />));
    for (let i = 0; i < 4; i++) await more();
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(TOTAL);
  });

  it('goes back to page 1 when the query changes', async () => {
    const view = await render(wrap(<Probe q={FEED} />));
    await more();
    expect(state().startsWith(`${2 * N}|`)).toBe(true);
    await view.rerender(wrap(<Probe q={{ ...FEED, kind: 'agora' }} />));
    expect(state().startsWith(`${N}|`)).toBe(true);
  });

  it('puts this device\'s new thread on top without a refetch', async () => {
    await render(wrap(<Probe q={FEED} />));
    await act(async () => {
      useCommunity.getState().createThread({ eventId: 'e1', eventName: 'X', kind: 'grupo', title: 'Minha', anonymous: true });
    });
    const head = state().split('|')[2];
    expect(head).toMatch(/^th-/);
  });

  it('hides archived threads from the feed but not from an event page', async () => {
    useCommunity.setState({
      threads: [
        { id: 'th-old', eventId: 'e1', eventName: 'X', kind: 'agora', title: 'Encerrada', author: { anonymous: true }, createdAt: '2026-10-31T04:00:00Z', commentCount: 0, helpfulCount: 0, mine: true, archived: true } as never,
      ],
    });
    mockEnv.demoThreads = 0;
    const feed = await render(wrap(<Probe q={FEED} />));
    expect(state().startsWith('3|')).toBe(true); // only the 3 demo threads
    await feed.rerender(wrap(<Probe q={{ ...FEED, eventId: 'e1', includeArchived: true }} />));
    expect(state().startsWith('1|false|th-old')).toBe(true);
  });
});

describe('FeedScreen (local mode)', () => {
  it('asks for the next page at the end of the list and shows a calm ending with a way to post', async () => {
    await render(wrap(<FeedScreen />));
    expect(screen.queryByTestId('comunidade-end')).toBeNull();
    const list = screen.getByTestId('comunidade-list');
    for (let i = 0; i < 4; i++) await fireEvent(list, 'endReached');
    expect(screen.getByTestId('comunidade-end')).toBeTruthy();
    expect(screen.getByText('Você viu tudo por aqui.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Começar uma conversa' })).toBeTruthy();
  });

  it('shows an empty state per scope instead of a blank list', async () => {
    mockEnv.demoThreads = 0;
    await render(wrap(<FeedScreen />));
    await fireEvent.press(screen.getByRole('tab', { name: 'Seguindo' }));
    expect(screen.getByText('Nenhuma conversa seguida')).toBeTruthy();
  });
});

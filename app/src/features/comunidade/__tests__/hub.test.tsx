import '@/ui/testSetup';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { useCommunity } from '@/state/community';
import { EventoConversaScreen } from '../EventoConversaScreen';

const mockEvent = { venueSlug: 'casa-mare' };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/env', () => ({ env: { demoThreads: 0, dataSource: 'seed', supabaseUrl: '', supabaseAnonKey: '', demoTools: true, appEnv: 'test', feedUrl: '' } }));
jest.mock('@/data/queries', () => ({
  useEvent: () => ({
    data: { event: { id: 'e1', title: 'Noite do Pagodão' }, venue: { name: 'Casa Maré', slug: mockEvent.venueSlug } },
    isPending: false,
    isError: false,
    fetchStatus: 'idle',
  }),
}));

const wrap = () => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
    <EventoConversaScreen id="e1" />
  </QueryClientProvider>
);

beforeEach(() => {
  mockEvent.venueSlug = 'casa-mare';
  useCommunity.setState({ handle: undefined, threads: [], comments: [], votedIds: [], reportedIds: [], reportSentIds: [], aliases: {}, handleTaken: false });
});

describe('EventoConversaScreen', () => {
  it('opens on "Vale a pena?" sorted by helpful votes, and shows the pinned reply', async () => {
    await render(wrap());
    expect(screen.getByText('Noite do Pagodão')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mais úteis' })).toBeSelected();
    expect(screen.getByRole('button', { name: /^Vale pagar o camarote ou a pista já resolve\?\./ })).toBeTruthy();
    expect(screen.getByLabelText('Mais útil · 18 pessoas')).toBeTruthy();
  });

  it('switching to "Agora" sorts by recency again, and keeps only that kind', async () => {
    await render(wrap());
    await fireEvent.press(screen.getByRole('tab', { name: 'Agora' }));
    expect(screen.getByRole('button', { name: 'Recentes' })).toBeSelected();
    expect(screen.getByRole('button', { name: /^Fila na portaria, quanto tempo\?\./ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Vale pagar o camarote/ })).toBeNull();
  });

  it('shows an honest empty state when the event has no conversations of that kind', async () => {
    mockEvent.venueSlug = 'outra-casa';
    await render(wrap());
    expect(screen.getByText('Ainda sem conversas')).toBeTruthy();
  });

  it('keeps "Agora" threads of an ended event here as history (the feed hides them)', async () => {
    mockEvent.venueSlug = 'outra-casa';
    useCommunity.setState({
      threads: [
        { id: 'th-x', eventId: 'e1', eventName: 'Noite do Pagodão', kind: 'agora', title: 'Fila era enorme', author: { anonymous: true }, createdAt: '2026-10-31T01:00:00Z', commentCount: 0, helpfulCount: 0, mine: true, archived: true } as never,
      ],
    });
    await render(wrap());
    await fireEvent.press(screen.getByRole('tab', { name: 'Agora' }));
    expect(screen.getByRole('button', { name: /^Fila era enorme\./ })).toBeTruthy();
  });
});

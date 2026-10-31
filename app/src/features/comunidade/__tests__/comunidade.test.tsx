import '@/ui/testSetup';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { useCommunity } from '@/state/community';
import { ThreadScreen } from '../ThreadScreen';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

beforeEach(() =>
  useCommunity.setState({ handle: undefined, threads: [], comments: [], votedIds: [], reportedIds: [], reportSentIds: [], aliases: {}, handleTaken: false }),
);

const renderThread = (id: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <ThreadScreen id={id} />
    </QueryClientProvider>,
  );

describe('ThreadScreen (demo thread)', () => {
  it('pins the Mais útil comment first, above higher-ranked newer ones', async () => {
    await renderThread("demo-th-1");
    // demo-cm-1 has 18 votes; it is badged and rendered before demo-cm-3 (9 votes).
    expect(screen.getByLabelText('Mais útil')).toBeTruthy();
    const ids = screen.getAllByTestId(/^comentario-/).map((n) => n.props.testID);
    expect(ids.indexOf('comentario-demo-cm-1')).toBeLessThan(ids.indexOf('comentario-demo-cm-3'));
  });

  it('shows no Mais útil badge below the threshold', async () => {
    await renderThread("demo-th-2");
    expect(screen.queryByLabelText('Mais útil')).toBeNull();
  });

  it('masks anonymous authors', async () => {
    await renderThread("demo-th-1");
    expect(screen.getAllByText('Anônimo').length).toBeGreaterThan(0);
  });

  it('counts the viewer\'s vote and promotes a comment to Mais útil at 3', async () => {
    await renderThread("demo-th-2");
    // demo-cm-5 has 2 votes; one more reaches TOP_HELPFUL_MIN.
    await fireEvent.press(screen.getByRole('button', { name: 'Útil, 2' }));
    expect(screen.getByLabelText('Mais útil')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Útil, 3' })).toBeSelected();
  });

  it('offers Responder only on top-level comments', async () => {
    await renderThread("demo-th-1");
    // 3 top-level comments, 1 nested reply (no Responder on it).
    expect(screen.getAllByRole('button', { name: 'Responder' })).toHaveLength(3);
  });

  it('asks for a handle before a named reply, and accepts an anonymous one', async () => {
    await renderThread("demo-th-2");
    expect(screen.getByTestId('comunidade-handle')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('comunidade-resposta'), 'Também vou!');
    await fireEvent.press(screen.getByTestId('comunidade-enviar'));
    expect(screen.getByText('Escolha seu @ para responder com nome.')).toBeTruthy();
    expect(useCommunity.getState().comments).toHaveLength(0);

    await fireEvent(screen.getByRole('switch', { name: 'Responder como anônimo' }), 'valueChange', true);
    await fireEvent.press(screen.getByTestId('comunidade-enviar'));
    expect(useCommunity.getState().comments[0]).toMatchObject({ body: 'Também vou!', author: { anonymous: true } });
  });

  it('keeps resolving a thread opened on its local id after it synced (alias)', async () => {
    useCommunity.setState({
      threads: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          eventId: 'e1',
          eventName: 'Noite',
          kind: 'grupo',
          title: 'Mesa para 4',
          author: { anonymous: true },
          createdAt: '2026-10-31T01:00:00Z',
          commentCount: 0,
          helpfulCount: 0,
          mine: true,
        },
      ],
      aliases: { 'th-old': '22222222-2222-4222-8222-222222222222' },
    });
    await renderThread('th-old');
    expect(screen.getByText('Mesa para 4')).toBeTruthy();
    expect(screen.queryByText('Conversa não encontrada')).toBeNull();
  });

  it('does not offer a vote on your own comment, but still on others', async () => {
    useCommunity.setState({
      comments: [
        {
          id: 'cm-mine',
          threadId: 'demo-th-2',
          author: { anonymous: true },
          body: 'Meu comentário',
          createdAt: '2026-10-31T02:00:00Z',
          helpfulCount: 0,
          mine: true,
        },
      ],
    });
    await renderThread('demo-th-2');
    expect(screen.getByRole('button', { name: 'Útil, 0' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Útil, 2' })).not.toBeDisabled();
    // Denunciar only on the other person's comment.
    expect(screen.getAllByRole('button', { name: 'Denunciar' })).toHaveLength(1);
  });

  it('tells the user when the handle they chose offline was taken', async () => {
    useCommunity.setState({ handleTaken: true });
    await renderThread('demo-th-2');
    expect(screen.getByText(/já é de outra pessoa/)).toBeTruthy();
  });

  it('shows the not-found state for an unknown thread', async () => {
    await renderThread("nope");
    expect(screen.getByText('Conversa não encontrada')).toBeTruthy();
  });
});

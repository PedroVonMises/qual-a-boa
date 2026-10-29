import '@/ui/testSetup';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { SeedRepo, setRepo } from '@/data';
import { MINI_NOW, miniDataset } from '@/data/__fixtures__/mini';
import type { Review } from '@/domain/engage';
import { useCheckins } from '@/state/checkins';
import { useFollows } from '@/state/follows';
import { useReviews } from '@/state/reviews';
import { MeusEventosScreen } from '../MeusEventosScreen';
import { REVIEW_STATUS_LABEL, sortCheckins, sortFollows, sortReviews, tabLabel } from '../logic';

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const [E1, E2] = miniDataset.events.map((e) => e.id);
const review = (over: Partial<Review>): Review => ({
  id: 'r1',
  eventId: E1,
  rating: 4,
  topics: {},
  tags: [],
  anonymous: false,
  attended: true,
  status: 'pending',
  createdAt: '2026-10-20T12:00:00.000Z',
  helpfulCount: 0,
  mine: true,
  ...over,
});

const mount = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <MeusEventosScreen />
    </QueryClientProvider>,
  );

beforeEach(() => {
  mockPush.mockClear();
  mockReplace.mockClear();
  setRepo(new SeedRepo(miniDataset, () => Date.parse(MINI_NOW)));
  useReviews.setState({ mine: [] });
  useCheckins.setState({ checkins: [] });
  useFollows.setState({ follows: {}, changes: [] });
});

describe('logic', () => {
  it('sorts newest first without mutating the store arrays', () => {
    const list = [review({ id: 'old', createdAt: '2026-10-01T00:00:00.000Z' }), review({ id: 'new', createdAt: '2026-10-09T00:00:00.000Z' })];
    expect(sortReviews(list).map((r) => r.id)).toEqual(['new', 'old']);
    expect(list.map((r) => r.id)).toEqual(['old', 'new']);
    expect(sortCheckins([{ eventId: 'a', at: '2026-10-01T00:00:00.000Z' }, { eventId: 'b', at: '2026-10-02T00:00:00.000Z' }]).map((c) => c.eventId)).toEqual(['b', 'a']);
    const f = (eventId: string, followedAt: string) => ({ eventId, followedAt, hasTicket: false, alerts: {}, channels: {} }) as never;
    expect(sortFollows({ a: f('a', '2026-10-01T00:00:00.000Z'), b: f('b', '2026-10-05T00:00:00.000Z') }).map((x) => x.eventId)).toEqual(['b', 'a']);
  });

  it('labels every review status in pt-BR and tabs with counts', () => {
    expect(REVIEW_STATUS_LABEL).toEqual({ pending: 'Em análise', published: 'Publicada', hidden: 'Removida' });
    expect(tabLabel('Avaliações', 2)).toBe('Avaliações · 2');
  });
});

describe('MeusEventosScreen', () => {
  it('starts on reviews with an empty state that sends you back to Explorar', async () => {
    await mount();
    expect(screen.getByText('Nenhuma avaliação ainda')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Explorar eventos' }));
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('lists your reviews with the event title and moderation status', async () => {
    useReviews.setState({
      mine: [review({ id: 'a', eventId: E1, status: 'pending' }), review({ id: 'b', eventId: E2, status: 'published', createdAt: '2026-10-22T00:00:00.000Z' })],
    });
    await mount();
    expect(await screen.findByText(miniDataset.events[0].title)).toBeTruthy();
    expect(screen.getByText('Em análise')).toBeTruthy();
    expect(screen.getByText('Publicada')).toBeTruthy();
    expect(screen.getByText('Avaliações · 2')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('meus-review-a'));
    expect(mockPush).toHaveBeenCalledWith(`/avaliacoes/${E1}`);
  });

  it('switches to check-ins and opens the event', async () => {
    useCheckins.setState({ checkins: [{ eventId: E1, at: '2026-10-23T14:00:00.000Z' }] });
    await mount();
    await fireEvent.press(screen.getByText('Check-ins · 1'));
    await screen.findByText(miniDataset.events[0].title);
    await fireEvent.press(screen.getByTestId(`meus-checkin-${E1}`));
    expect(mockPush).toHaveBeenCalledWith(`/evento/${E1}`);
  });

  it('shows followed events and flags those with a ticket', async () => {
    useFollows.setState({
      follows: {
        [E1]: { eventId: E1, followedAt: '2026-10-21T10:00:00.000Z', hasTicket: true, alerts: {}, channels: {} } as never,
      },
      changes: [],
    });
    await mount();
    await fireEvent.press(screen.getByText('Acompanhando · 1'));
    expect(await screen.findByText('Com ingresso')).toBeTruthy();
  });

  it('degrades to "Evento indisponível" when the event left the catalog', async () => {
    useCheckins.setState({ checkins: [{ eventId: 'gone', at: '2026-10-23T14:00:00.000Z' }] });
    await mount();
    await fireEvent.press(screen.getByText('Check-ins · 1'));
    expect(await screen.findByText('Evento indisponível')).toBeTruthy();
  });
});

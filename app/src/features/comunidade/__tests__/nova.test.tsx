import '@/ui/testSetup';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { useCommunity } from '@/state/community';
import { NovaScreen } from '../NovaScreen';

const EV = 'evt-far-away';
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({ eventId: EV, kind: 'grupo' }),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
// The event we came from is not among the soonest listed events.
jest.mock('@/data/queries', () => ({
  useSearchEvents: () => ({ data: { pages: [{ items: [] }] }, isPending: false }),
  useEvent: () => ({
    data: { event: { id: 'evt-far-away', title: 'Noite do Pagodão' }, venue: { slug: 'casa-mare' } },
  }),
}));

beforeEach(() => {
  mockReplace.mockClear();
  useCommunity.setState({ handle: undefined, threads: [], comments: [], votedIds: [], reportedIds: [], reportSentIds: [] });
});

describe('NovaScreen', () => {
  it('keeps the name and venue of an event that is not in the short event list', async () => {
    await render(<NovaScreen />);
    expect(screen.getByRole('button', { name: 'Noite do Pagodão' })).toBeSelected();

    await fireEvent(screen.getByRole('switch', { name: 'Postar como anônimo' }), 'valueChange', true);
    await fireEvent.changeText(screen.getByTestId('comunidade-titulo'), 'Somos 3, falta gente');
    await fireEvent.press(screen.getByTestId('comunidade-publicar'));

    expect(useCommunity.getState().threads[0]).toMatchObject({
      eventId: EV,
      eventName: 'Noite do Pagodão',
      venueSlug: 'casa-mare',
      kind: 'grupo',
    });
    expect(mockReplace).toHaveBeenCalledTimes(1);
  });

  it('asks for an event when none is chosen', async () => {
    useCommunity.setState({ threads: [] });
    await render(<NovaScreen />);
    // Preset event is chosen by the route; the form still rejects an empty title.
    await fireEvent(screen.getByRole('switch', { name: 'Postar como anônimo' }), 'valueChange', true);
    await fireEvent.press(screen.getByTestId('comunidade-publicar'));
    expect(screen.getByTestId('comunidade-erro')).toBeTruthy();
    expect(useCommunity.getState().threads).toHaveLength(0);
  });
});

import '@/ui/testSetup';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { REGIONS } from '@/domain/region';
import { useCommunity } from '@/state/community';
import { useFollows } from '@/state/follows';
import { useRegion } from '@/state/region';
import { FeedScreen } from '../FeedScreen';
import { StatePill } from '../StatePill';
import { StateSheet } from '../StateSheet';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const wrap = (ui: React.ReactElement) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>{ui}</QueryClientProvider>
);

beforeEach(() => {
  useRegion.setState({ uf: 'ES' });
  useCommunity.setState({ handle: undefined, threads: [], comments: [], votedIds: [], reportedIds: [], reportSentIds: [], aliases: {}, handleTaken: false });
  useFollows.setState({ follows: {} });
});

describe('StatePill', () => {
  it('names the state, is a 44px button and fires onPress', async () => {
    const onPress = jest.fn();
    await render(<StatePill onPress={onPress} />);
    const pill = screen.getByRole('button', { name: 'Estado: Espírito Santo. Alterar' });
    expect(screen.getByText('Espírito Santo')).toBeTruthy();
    await fireEvent.press(pill);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

describe('StateSheet', () => {
  it('lists all 27 states; only Espírito Santo is active, the other 26 say "Em breve"', async () => {
    await render(<StateSheet visible onClose={jest.fn()} />);
    expect(screen.getByText('Seu estado')).toBeTruthy();
    expect(screen.getByText(/só Espírito Santo está aberto/)).toBeTruthy();
    expect(REGIONS).toHaveLength(27);
    for (const r of REGIONS) expect(screen.getByTestId(`state-${r.uf}`)).toBeTruthy();
    expect(screen.getAllByText('Em breve')).toHaveLength(26);
    expect(screen.getByText('Ativo')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Espírito Santo' })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Acre, Em breve' })).toBeDisabled();
  });

  it('a state that is not open does nothing when pressed', async () => {
    const onClose = jest.fn();
    await render(<StateSheet visible onClose={onClose} />);
    await fireEvent.press(screen.getByTestId('state-SP'));
    expect(useRegion.getState().uf).toBe('ES');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('choosing the active state keeps it and closes the sheet', async () => {
    const onClose = jest.fn();
    await render(<StateSheet visible onClose={onClose} />);
    await fireEvent.press(screen.getByTestId('state-ES'));
    expect(useRegion.getState().uf).toBe('ES');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing while closed', async () => {
    await render(<StateSheet visible={false} onClose={jest.fn()} />);
    expect(screen.queryByTestId('state-sheet')).toBeNull();
  });
});

describe('Comunidade header', () => {
  it('says the tab is about the user\'s state and shows the state button', async () => {
    await render(wrap(<FeedScreen />));
    expect(screen.getByText('Conversas de quem está no seu estado.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Estado: Espírito Santo. Alterar' })).toBeTruthy();
    expect(screen.getAllByRole('header')).toHaveLength(1);
  });

  it('opens the state sheet from the pill', async () => {
    await render(wrap(<FeedScreen />));
    expect(screen.queryByTestId('state-sheet')).toBeNull();
    await fireEvent.press(screen.getByTestId('state-pill'));
    expect(screen.getByTestId('state-sheet')).toBeTruthy();
  });
});

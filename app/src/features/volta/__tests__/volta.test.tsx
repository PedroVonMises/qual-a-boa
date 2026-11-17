import '@/ui/testSetup';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Linking from 'expo-linking';

import { setRepo, SeedRepo } from '@/data';
import { miniDataset, MINI_NOW } from '@/data/__fixtures__/mini';
import * as reminder from '@/lib/reminder';
import { useVolta } from '@/state/volta';
import { VoltaScreen } from '../VoltaScreen';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
}));
jest.mock('expo-linking', () => ({ openURL: jest.fn(() => Promise.resolve(true)), createURL: (p: string) => p }));
jest.mock('@/lib/reminder', () => ({
  remindersSupported: jest.fn(() => true),
  scheduleArrivalReminder: jest.fn(() => Promise.resolve('rem-1')),
  cancelReminder: jest.fn(() => Promise.resolve()),
}));

const rem = reminder as jest.Mocked<typeof reminder>;
const event = miniDataset.events[0];
const venue = miniDataset.venues.find((v) => v.id === event.venueId)!;

async function show() {
  setRepo(new SeedRepo(miniDataset, () => Date.parse(MINI_NOW)));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <QueryClientProvider client={client}>
      <VoltaScreen eventId={event.id} />
    </QueryClientProvider>,
  );
}

async function addContact(name: string, phone: string) {
  await fireEvent.changeText(screen.getByTestId('volta-nome'), name);
  await fireEvent.changeText(screen.getByTestId('volta-telefone'), phone);
  await fireEvent.press(screen.getByTestId('volta-adicionar'));
}

beforeEach(() => {
  jest.clearAllMocks();
  useVolta.setState({ contacts: [], trip: null });
});

describe('Cheguei em casa (S5)', () => {
  it('keeps up to 3 contacts on the device and validates the phone', async () => {
    await show();
    await addContact('Ana', '123');
    expect(screen.getByText('Confira o número, com DDD.')).toBeTruthy();
    await addContact('Ana', '27 99999-0001');
    await addContact('Bia', '27 99999-0002');
    await addContact('Cris', '27 99999-0003');
    expect(useVolta.getState().contacts.map((c) => c.name)).toEqual(['Ana', 'Bia', 'Cris']);
    expect(screen.queryByTestId('volta-adicionar')).toBeNull();
    await fireEvent.press(screen.getByTestId('volta-remover-5527999990002'));
    expect(useVolta.getState().contacts.map((c) => c.name)).toEqual(['Ana', 'Cris']);
  });

  it('opens WhatsApp and SMS with the ready message for the event', async () => {
    useVolta.setState({ contacts: [{ id: 'a', name: 'Ana', phone: '5527999990001' }] });
    await show();
    await waitFor(() => expect(screen.getByTestId('volta-mensagem')).toHaveTextContent(`Tô saindo do ${event.title}, na ${venue.name}.`, { exact: false }));
    await fireEvent.press(screen.getByTestId('volta-whatsapp-5527999990001'));
    expect(Linking.openURL).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/wa\.me\/5527999990001\?text=T%C3%B4%20saindo/));
    await fireEvent.press(screen.getByTestId('volta-sms-5527999990001'));
    expect(Linking.openURL).toHaveBeenLastCalledWith(expect.stringMatching(/^sms:\+5527999990001[?&]body=/));
  });

  it('starts the trip with a local reminder, then "Cheguei" cancels it', async () => {
    useVolta.setState({ contacts: [{ id: 'a', name: 'Ana', phone: '5527999990001' }] });
    await show();
    await fireEvent.press(screen.getByTestId('volta-lembrete-60'));
    await fireEvent.press(screen.getByTestId('volta-saindo'));
    await waitFor(() => expect(useVolta.getState().trip).not.toBeNull());
    expect(rem.scheduleArrivalReminder).toHaveBeenCalledWith(60);
    expect(useVolta.getState().trip).toMatchObject({ eventId: event.id, reminderId: 'rem-1', place: { venueName: venue.name, eventTitle: event.title } });
    expect(screen.getByTestId('volta-ativa-detalhe')).toHaveTextContent(/Vamos perguntar se chegou/);

    await fireEvent.press(screen.getByTestId('volta-whatsapp-5527999990001'));
    expect(Linking.openURL).toHaveBeenCalledWith('https://wa.me/5527999990001?text=Cheguei%20em%20casa%2C%20tudo%20certo!');
    await fireEvent.press(screen.getByTestId('volta-cheguei'));
    await waitFor(() => expect(useVolta.getState().trip).toBeNull());
    expect(rem.cancelReminder).toHaveBeenCalledWith('rem-1');
  });

  it('"Não lembrar" schedules nothing', async () => {
    useVolta.setState({ contacts: [{ id: 'a', name: 'Ana', phone: '5527999990001' }] });
    await show();
    await fireEvent.press(screen.getByTestId('volta-lembrete-nao'));
    await fireEvent.press(screen.getByTestId('volta-saindo'));
    await waitFor(() => expect(useVolta.getState().trip).not.toBeNull());
    expect(rem.scheduleArrivalReminder).not.toHaveBeenCalled();
    expect(useVolta.getState().trip?.remindAt).toBeUndefined();
  });
});

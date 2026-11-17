import '@/ui/testSetup';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Linking from 'expo-linking';
import { Share } from 'react-native';

import * as location from '@/lib/location';
import { EmergencyActions } from '../EmergencyActions';

jest.mock('expo-linking', () => ({ openURL: jest.fn(() => Promise.resolve(true)), createURL: (p: string) => p }));
jest.mock('@/lib/location', () => ({
  getPermission: jest.fn(),
  requestPermission: jest.fn(),
  getFix: jest.fn(),
}));

const loc = location as jest.Mocked<typeof location>;
const place = { name: 'Casa Maré', lat: -20.3, lng: -40.29, eventTitle: 'Noite do Funk' };
let share: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction', activityType: undefined });
});

describe('Botões de emergência (S4)', () => {
  it('calls 190 and 180 with one tap', async () => {
    await render(<EmergencyActions place={place} />);
    await fireEvent.press(screen.getByTestId('emergencia-ligar-190'));
    await fireEvent.press(screen.getByTestId('emergencia-ligar-180'));
    expect(Linking.openURL).toHaveBeenNthCalledWith(1, 'tel:190');
    expect(Linking.openURL).toHaveBeenNthCalledWith(2, 'tel:180');
  });

  it('shares my position through the system sheet, asking for permission only on tap', async () => {
    loc.getPermission.mockResolvedValue('undetermined');
    loc.requestPermission.mockResolvedValue('granted');
    loc.getFix.mockResolvedValue({ ok: true, fix: { point: { lat: -20.31, lng: -40.3, label: 'Praia do Canto' }, accuracyM: 20, at: '' } });
    await render(<EmergencyActions place={place} />);
    expect(loc.getPermission).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('emergencia-localizacao'));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(loc.requestPermission).toHaveBeenCalled();
    expect(share.mock.calls[0][0].message).toContain('Minha localização agora: https://www.google.com/maps/search/?api=1&query=-20.310000,-40.300000');
    expect(screen.queryByTestId('emergencia-aviso')).toBeNull();
  });

  it('without permission it shares the venue and says so', async () => {
    loc.getPermission.mockResolvedValue('blocked');
    await render(<EmergencyActions place={place} />);
    await fireEvent.press(screen.getByTestId('emergencia-localizacao'));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(loc.getFix).not.toHaveBeenCalled();
    expect(share.mock.calls[0][0].message).toContain('Endereço no mapa: https://www.google.com/maps/search/?api=1&query=-20.300000,-40.290000');
    expect(await screen.findByTestId('emergencia-aviso')).toHaveTextContent(/endereço da casa/);
  });
});

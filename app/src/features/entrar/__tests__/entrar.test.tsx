import '@/ui/testSetup';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import * as auth from '@/data/auth';
import { syncAll } from '@/data/sync';
import { EntrarScreen } from '../EntrarScreen';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack, push: jest.fn(), replace: jest.fn() }) }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/data/sync',() => ({ syncAll: jest.fn(() => Promise.resolve()) }));
jest.mock('@/data/auth', () => ({
  ...jest.requireActual('@/data/auth'),
  requestEmailCode: jest.fn(),
  confirmEmailCode: jest.fn(),
}));

const request = auth.requestEmailCode as jest.Mock;
const confirm = auth.confirmEmailCode as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

const press = async (id: string) => {
  await act(async () => {
    await fireEvent.press(screen.getByTestId(id));
  });
};

describe('EntrarScreen', () => {
  it('rejects a bad email locally', async () => {
    await render(<EntrarScreen />);
    await fireEvent.changeText(screen.getByTestId('entrar-email'), 'nope');
    await press('entrar-enviar');
    expect(screen.getByText('Esse e-mail não parece válido.')).toBeTruthy();
    expect(request).not.toHaveBeenCalled();
  });

  it('shows the backend error from requesting a code', async () => {
    request.mockResolvedValue({ ok: false, error: 'Muitas tentativas. Aguarde um minuto e tente de novo.' });
    await render(<EntrarScreen />);
    await fireEvent.changeText(screen.getByTestId('entrar-email'), 'ana@exemplo.com');
    await press('entrar-enviar');
    expect(screen.getByText(/Muitas tentativas/)).toBeTruthy();
    expect(screen.queryByTestId('entrar-codigo')).toBeNull();
  });

  it('goes from email to code, confirms, syncs and returns', async () => {
    request.mockResolvedValue({ ok: true, mode: 'link' });
    confirm.mockResolvedValue({ ok: true });
    await render(<EntrarScreen />);
    await fireEvent.changeText(screen.getByTestId('entrar-email'), 'Ana@Exemplo.com');
    await press('entrar-enviar');
    expect(screen.getByText(/ana@exemplo.com/)).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('entrar-codigo'), '123 456');
    await press('entrar-confirmar');
    expect(confirm).toHaveBeenCalledWith('Ana@Exemplo.com', '123456', 'link');
    expect(syncAll).toHaveBeenCalled();
    expect(mockBack).toHaveBeenCalled();
  });

  it('stays on the code step with an error for a wrong code', async () => {
    request.mockResolvedValue({ ok: true, mode: 'signin' });
    confirm.mockResolvedValue({ ok: false, error: 'O código expirou ou está incorreto. Peça um novo.' });
    await render(<EntrarScreen />);
    await fireEvent.changeText(screen.getByTestId('entrar-email'), 'ana@exemplo.com');
    await press('entrar-enviar');
    await fireEvent.changeText(screen.getByTestId('entrar-codigo'), '000000');
    await press('entrar-confirmar');
    expect(screen.getByText(/expirou/)).toBeTruthy();
    expect(mockBack).not.toHaveBeenCalled();
    expect(syncAll).not.toHaveBeenCalled();
  });

  it('lets the user go back and use another email', async () => {
    request.mockResolvedValue({ ok: true, mode: 'signin' });
    await render(<EntrarScreen />);
    await fireEvent.changeText(screen.getByTestId('entrar-email'), 'ana@exemplo.com');
    await press('entrar-enviar');
    await fireEvent.press(screen.getByRole('button', { name: 'Usar outro e-mail' }));
    expect(screen.getByTestId('entrar-email')).toBeTruthy();
  });
});

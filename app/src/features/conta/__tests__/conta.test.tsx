import '@/ui/testSetup';
import type { SupabaseClient } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { setSupabase } from '@/data/supabaseClient';
import { shareTextFile } from '@/lib/shareFile';
import { useFavorites } from '@/state/favorites';
import { useReviews } from '@/state/reviews';
import { ContaScreen } from '../ContaScreen';

const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace, back: mockBack, push: jest.fn() }) }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/env', () => ({
  env: { dataSource: 'supabase', supabaseUrl: 'http://x', supabaseAnonKey: 'k', demoTools: false },
}));
jest.mock('@/lib/shareFile', () => ({ shareTextFile: jest.fn(() => Promise.resolve(true)) }));

interface Opts {
  user?: { id: string; email?: string; is_anonymous?: boolean } | null;
  profile?: string | null;
  invokeError?: { message: string } | null;
  upsertError?: { message: string } | null;
}

let calls: Array<[string, unknown]> = [];
function install(o: Opts = {}) {
  calls = [];
  const user = o.user === undefined ? { id: 'u1', email: 'ana@exemplo.com', is_anonymous: false } : o.user;
  const auth = {
    getSession: async () => ({ data: { session: user ? { user } : null } }),
    getUser: async () => ({ data: { user }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
    signInAnonymously: async () => ({ data: { user: null }, error: { message: 'disabled' } }),
    signOut: async (a: unknown) => (calls.push(['signOut', a]), { error: null }),
  };
  const from = () => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: o.profile ? { display_name: o.profile } : null, error: null }) }) }),
    upsert: async (row: unknown) => (calls.push(['upsert', row]), { error: o.upsertError ?? null }),
  });
  const functions = { invoke: async (name: string) => (calls.push(['invoke', name]), { data: null, error: o.invokeError ?? null }) };
  setSupabase({ auth, from, functions } as unknown as SupabaseClient);
}

const mount = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <ContaScreen />
    </QueryClientProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  useFavorites.setState({ eventIds: ['e1'], venueIds: ['bolt'], artistSlugs: [] });
  useReviews.setState({ mine: [] });
});
afterEach(() => setSupabase(null));

describe('ContaScreen', () => {
  it('shows the account email and loads the saved name into the field', async () => {
    install({ profile: 'Ana' });
    await mount();
    expect(await screen.findByText('ana@exemplo.com')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('conta-nome').props.value).toBe('Ana'));
    expect(screen.getByTestId('conta-sair')).toBeTruthy();
  });

  it('presents a visitor without a sign-out row', async () => {
    install({ user: { id: 'u1', is_anonymous: true } });
    await mount();
    expect(await screen.findByText('Visitante')).toBeTruthy();
    expect(screen.queryByTestId('conta-sair')).toBeNull();
  });

  it('saves the name', async () => {
    install();
    await mount();
    await fireEvent.changeText(screen.getByTestId('conta-nome'), '  Ana   Paula ');
    await fireEvent.press(screen.getByTestId('conta-salvar-nome'));
    expect(await screen.findByText('Nome salvo.')).toBeTruthy();
    expect(calls).toContainEqual(['upsert', { id: 'u1', display_name: 'Ana Paula' }]);
  });

  it('rejects an empty name without calling the backend', async () => {
    install();
    await mount();
    await fireEvent.press(screen.getByTestId('conta-salvar-nome'));
    expect(await screen.findByText('Digite um nome.')).toBeTruthy();
    expect(calls.find((c) => c[0] === 'upsert')).toBeUndefined();
  });

  it('exports the user\'s data as a JSON file', async () => {
    install();
    await mount();
    await fireEvent.press(screen.getByTestId('conta-exportar'));
    await waitFor(() => expect(shareTextFile).toHaveBeenCalledTimes(1));
    const [filename, text] = (shareTextFile as jest.Mock).mock.calls[0] as [string, string];
    expect(filename).toMatch(/^qual-a-boa-meus-dados-\d{4}-\d{2}-\d{2}\.json$/);
    expect(JSON.parse(text)).toMatchObject({ account: { email: 'ana@exemplo.com' }, favorites: { events: ['e1'], venues: ['bolt'] } });
    expect(await screen.findByText('Arquivo gerado.')).toBeTruthy();
  });
});

describe('erasing the account', () => {
  const openConfirm = async () => {
    await mount();
    await fireEvent.press(screen.getByTestId('conta-apagar'));
  };

  it('asks for confirmation first and lists what is erased', async () => {
    install();
    await openConfirm();
    expect(await screen.findByText('Apagar sua conta?')).toBeTruthy();
    expect(screen.getByText(/fotos que você enviou/)).toBeTruthy();
    expect(calls.find((c) => c[0] === 'invoke')).toBeUndefined();
  });

  it('cancelling changes nothing', async () => {
    install();
    await openConfirm();
    await fireEvent.press(await screen.findByTestId('conta-cancelar'));
    expect(calls.find((c) => c[0] === 'invoke')).toBeUndefined();
    expect(useFavorites.getState().eventIds).toEqual(['e1']);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('on success: erases on the server, wipes this device and returns to the start', async () => {
    install();
    await openConfirm();
    await fireEvent.press(await screen.findByTestId('conta-confirmar-apagar'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
    expect(calls).toContainEqual(['invoke', 'delete-account']);
    expect(useFavorites.getState()).toMatchObject({ eventIds: [], venueIds: [] });
  });

  it('on failure: keeps every local record, explains, and does not navigate away', async () => {
    install({ invokeError: { message: 'FunctionsHttpError' } });
    await openConfirm();
    await fireEvent.press(await screen.findByTestId('conta-confirmar-apagar'));
    expect(await screen.findByText(/continua de onde parou/)).toBeTruthy();
    expect(useFavorites.getState().eventIds).toEqual(['e1']);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(calls.find((c) => c[0] === 'signOut')).toBeUndefined();
  });
});

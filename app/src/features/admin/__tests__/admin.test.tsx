import '@/ui/testSetup';
import type { SupabaseClient } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { setSupabase } from '@/data/supabaseClient';
import { AdminScreen } from '../AdminScreen';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
let mockSource = 'supabase';
jest.mock('@/lib/env', () => ({
  env: {
    get dataSource() {
      return mockSource;
    },
    supabaseUrl: 'http://x',
    supabaseAnonKey: 'k',
    demoTools: false,
  },
}));

const EV = '11111111-1111-4111-8111-111111111111';
const ACC = '22222222-2222-4222-8222-222222222222';
const TK = '33333333-3333-4333-8333-333333333333';
const recent = () => new Date(Date.now() - 2 * 3_600_000).toISOString();
const old = () => new Date(Date.now() - 14 * 3_600_000).toISOString();

type Rpc = (fn: string, args?: Record<string, unknown>) => { data?: unknown; error?: { message: string } | null };
let rpcCalls: [string, Record<string, unknown> | undefined][] = [];

function install(rpc: Rpc, user: { id: string; email?: string; is_anonymous?: boolean } | null = { id: 'staff', email: 'bia@qualaboa.app' }) {
  rpcCalls = [];
  const auth = {
    getSession: async () => ({ data: { session: user ? { user } : null } }),
    getUser: async () => ({ data: { user }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
  };
  const client = {
    auth,
    rpc: async (fn: string, args?: Record<string, unknown>) => {
      rpcCalls.push([fn, args]);
      const r = rpc(fn, args);
      return { data: r.data ?? null, error: r.error ?? null };
    },
  };
  setSupabase(client as unknown as SupabaseClient);
}

const overview = (o: Record<string, unknown> = {}) => [{
  pending_events: 1, pending_accounts: 1, safety_seals: 0, hidden_posts: 0, open_safety_reports: 1,
  oldest_safety_report_at: recent(), ...o,
}];
const report = (createdAt = recent(), status = 'open') => ({
  ticket_id: TK, venue_id: 'v', venue_name: 'Bolt', event_title: 'Noite A', kind: 'assedio', checked_in: true,
  description: 'Um homem me seguiu.', ticket_status: status, created_at: createdAt, messages: [],
});
const festa = {
  id: EV, title: 'Noite do Pagodão', starts_at: '2026-12-05T02:00:00Z', ends_at: null, venue_name: 'Casa Maré', venue_slug: 'casa-mare',
  account_name: 'Casa Maré Ltda', is_free: false, price_min: 30, price_max: 50, ticket_url: null, age_min: 18, dress_code: 'Livre',
  poster_path: null, genre_slugs: ['pagode'], submitted_at: recent(),
};
const casa = {
  id: ACC, venue_id: null, venue_name: null, proposed_venue: { name: 'Bar Novo', address: 'Rua X, 1' }, cnpj: '11222333000181',
  legal_name: 'Bar Novo Ltda', contact_name: 'Rui', whatsapp: '+5527999990000', created_at: recent(),
};

const ING = '44444444-4444-4444-8444-444444444444';
const ingest = {
  id: ING, key: 'link:abc', tier: 2, title: 'Rock no Quintal', starts_at: '2026-12-05T01:00:00Z', venue_name: 'Quintal Rock Bar',
  venue_matched: false, source_url: 'https://quintal.example/rock', flags: ['venue-unverified', 'price-unknown'],
  details: { artists: ['Banda A', 'Banda B'] }, first_seen_at: recent(),
};

function staffRpc(over: Partial<Record<string, ReturnType<Rpc>>> = {}): Rpc {
  return (fn) => {
    if (fn in over) return over[fn]!;
    switch (fn) {
      case 'is_staff': return { data: true };
      case 'admin_overview': return { data: overview() };
      case 'admin_safety_reports': return { data: [report()] };
      case 'admin_pending_events': return { data: [festa] };
      case 'admin_pending_accounts': return { data: [casa] };
      case 'admin_recent_actions': return { data: [] };
      case 'admin_ingest_queue': return { data: [ingest] };
      default: return { data: 'ok' };
    }
  };
}

const mount = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>
      <AdminScreen />
    </QueryClientProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockSource = 'supabase';
});
afterAll(() => setSupabase(null));

describe('AdminScreen', () => {
  it('says the panel needs Supabase on seed builds', async () => {
    mockSource = 'seed';
    await mount();
    expect(screen.getByText(/só funciona com o Supabase/)).toBeTruthy();
  });

  it('asks visitors to sign in with the team account', async () => {
    install(staffRpc(), { id: 'anon', is_anonymous: true });
    await mount();
    await fireEvent.press(await screen.findByText('Entrar'));
    expect(mockPush).toHaveBeenCalledWith('/entrar');
    expect(rpcCalls.find(([f]) => f === 'is_staff')).toBeUndefined();
  });

  it('shows "área restrita" to people who are not on the team and never asks for the queues', async () => {
    install(staffRpc({ is_staff: { data: false } }));
    await mount();
    expect(await screen.findByText('Área restrita')).toBeTruthy();
    expect(rpcCalls.map(([f]) => f)).toEqual(['is_staff']);
  });

  it('opens on the safety reports with counters, and answers a report', async () => {
    install(staffRpc());
    await mount();
    expect(await screen.findByTestId(`admin-relato-${TK}`)).toBeTruthy();
    expect(screen.getByText('Assédio · Bolt')).toBeTruthy();
    expect(screen.getByTestId(`admin-relato-${TK}-prazo`).props.children).toMatch(/10 h para responder/);
    expect(screen.queryByTestId('admin-sla-alerta')).toBeNull();

    await fireEvent.press(screen.getByTestId(`admin-relato-${TK}-responder`));
    expect(screen.getByTestId(`admin-relato-${TK}-erro`).props.children).toBe('Escreva a resposta.');
    await fireEvent.changeText(screen.getByTestId(`admin-relato-${TK}-texto`), '  Sentimos muito. ');
    await fireEvent.press(screen.getByTestId(`admin-relato-${TK}-encerrar`));
    await waitFor(() => expect(rpcCalls.find(([f]) => f === 'admin_reply_ticket')).toBeTruthy());
    expect(rpcCalls.find(([f]) => f === 'admin_reply_ticket')![1]).toEqual({ p_ticket_id: TK, p_text: 'Sentimos muito.', p_close: true });
  });

  it('warns when a report waits past 12 hours', async () => {
    install(staffRpc({ admin_overview: { data: overview({ oldest_safety_report_at: old() }) }, admin_safety_reports: { data: [report(old())] } }));
    await mount();
    expect(await screen.findByTestId('admin-sla-alerta')).toBeTruthy();
    expect(screen.getByTestId(`admin-relato-${TK}-prazo`).props.children).toMatch(/vencido/);
  });

  it('approves a festa, and refuses one only with a reason', async () => {
    install(staffRpc());
    await mount();
    await fireEvent.press(await screen.findByTestId('admin-secao-festas'));
    expect(await screen.findByText('Noite do Pagodão')).toBeTruthy();
    expect(screen.getByText('Livre')).toBeTruthy();

    await fireEvent.press(screen.getByTestId(`admin-festa-${EV}-recusar`));
    expect(screen.getByTestId(`admin-festa-${EV}-erro`).props.children).toMatch(/motivo/);
    expect(rpcCalls.find(([f]) => f === 'admin_review_event')).toBeUndefined();

    await fireEvent.changeText(screen.getByTestId(`admin-festa-${EV}-nota`), 'Data errada');
    await fireEvent.press(screen.getByTestId(`admin-festa-${EV}-recusar`));
    await waitFor(() => expect(rpcCalls.find(([f]) => f === 'admin_review_event')).toBeTruthy());
    expect(rpcCalls.find(([f]) => f === 'admin_review_event')![1]).toEqual({ p_event_id: EV, p_approve: false, p_note: 'Data errada' });
  });

  it('shows the server error when a decision fails (another staff member decided first)', async () => {
    install(staffRpc({ admin_review_account: { error: { message: 'not_pending' } } }));
    await mount();
    await fireEvent.press(await screen.findByTestId('admin-secao-casas'));
    expect(await screen.findByText('Bar Novo')).toBeTruthy();
    expect(screen.getByText(/sem localização no mapa/)).toBeTruthy();
    expect(screen.getByText('11.222.333/0001-81')).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`admin-casa-${ACC}-verificar`));
    await waitFor(() => expect(screen.getByTestId(`admin-casa-${ACC}-erro`).props.children).toMatch(/já decidiu/));
  });

  it('approves an ingest record and refuses one only with a reason', async () => {
    install(staffRpc({ admin_overview: { data: overview({ ingest_pending: 1 }) } }));
    await mount();
    await fireEvent.press(await screen.findByTestId('admin-secao-ingestao'));
    expect(await screen.findByText('Rock no Quintal')).toBeTruthy();
    expect(screen.getByText('Casa fora do catálogo')).toBeTruthy();
    expect(screen.getByText('Sem preço')).toBeTruthy();
    expect(screen.getByText('Banda A, Banda B')).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`admin-ingest-${ING}-recusar`));
    expect(rpcCalls.find(([f]) => f === 'admin_review_ingest')).toBeUndefined();
    await fireEvent.press(screen.getByTestId(`admin-ingest-${ING}-aprovar`));
    await waitFor(() => expect(rpcCalls.find(([f]) => f === 'admin_review_ingest')).toBeTruthy());
    expect(rpcCalls.find(([f]) => f === 'admin_review_ingest')![1]).toEqual({ p_id: ING, p_approve: true, p_note: null });
  });
});

import type { SupabaseClient } from '@supabase/supabase-js';

import { useLocation } from '@/state/location';
import { useProfile, type ProfileAddress } from '@/state/profile';
import { fetchAddress, saveAddress, validateAddress } from './address';
import { setSupabase } from './supabaseClient';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
const mockEnv = { dataSource: 'supabase', supabaseUrl: 'http://x', supabaseAnonKey: 'k' };
jest.mock('@/lib/env', () => ({
  get env() {
    return mockEnv;
  },
}));

const ADDR: ProfileAddress = {
  cep: '29060-000', street: ' Rua da Lama ', number: '10', complement: '', district: 'Jardim da Penha', city: 'Vitória', uf: 'es', lat: -20.28, lng: -40.29,
};

type Err = { message: string } | null;
function install(o: { session?: string | null; row?: unknown; selectError?: Err; upsertError?: Err; upsertThrows?: boolean } = {}) {
  const calls: Array<[string, unknown]> = [];
  const sb = {
    auth: { getSession: async () => ({ data: { session: o.session === null ? null : { user: { id: o.session ?? 'u1' } } } }) },
    from: (table: string) => ({
      select: (cols: string) => ({
        eq: (col: string, val: unknown) => ({
          maybeSingle: async () => {
            calls.push(['select', { table, cols, col, val }]);
            return { data: o.row ?? null, error: o.selectError ?? null };
          },
        }),
      }),
      upsert: async (row: unknown, opts: unknown) => {
        calls.push(['upsert', { table, row, opts }]);
        if (o.upsertThrows) throw new Error('offline');
        return { error: o.upsertError ?? null };
      },
    }),
  };
  setSupabase(sb as unknown as SupabaseClient);
  return calls;
}

beforeEach(() => {
  mockEnv.dataSource = 'supabase';
  useProfile.getState().clear();
  useLocation.getState().resetLocation();
});
afterAll(() => setSupabase(null));

describe('validateAddress', () => {
  it('normalizes fields and rejects missing ones', () => {
    const r = validateAddress(ADDR);
    expect(r).toEqual({ ok: true, address: { cep: '29060000', street: 'Rua da Lama', number: '10', district: 'Jardim da Penha', city: 'Vitória', uf: 'ES', lat: -20.28, lng: -40.29 } });
    expect(validateAddress({ ...ADDR, cep: '123' })).toMatchObject({ ok: false, error: 'Digite um CEP com 8 números.' });
    expect(validateAddress({ ...ADDR, number: ' ' })).toMatchObject({ ok: false });
    expect(validateAddress({ ...ADDR, uf: 'Espírito Santo' })).toMatchObject({ ok: false });
    expect(validateAddress({ ...ADDR, lat: NaN })).toMatchObject({ ok: false });
  });
});

describe('saveAddress', () => {
  it('saves locally, sets the registered point and upserts when signed in', async () => {
    const calls = install();
    expect(await saveAddress(ADDR)).toEqual({ ok: true, synced: true });
    expect(useProfile.getState().address?.cep).toBe('29060000');
    expect(useLocation.getState().registered).toMatchObject({ label: 'Rua da Lama, 10' });
    const [kind, arg] = calls[0] as [string, { table: string; row: Record<string, unknown>; opts: unknown }];
    expect(kind).toBe('upsert');
    expect(arg.table).toBe('profile_addresses');
    expect(arg.row).toMatchObject({ user_id: 'u1', cep: '29060000', uf: 'ES', complement: null, lat: -20.28 });
    expect(arg.opts).toEqual({ onConflict: 'user_id' });
  });

  it('stays local without a session or a backend; never creates an account', async () => {
    const calls = install({ session: null });
    expect(await saveAddress(ADDR)).toEqual({ ok: true, synced: false });
    expect(calls).toEqual([]);
    mockEnv.dataSource = 'seed';
    expect(await saveAddress(ADDR)).toEqual({ ok: true, synced: false });
    expect(useProfile.getState().address).toBeDefined();
  });

  it('keeps the local copy and warns when the upload fails', async () => {
    install({ upsertError: { message: 'rls' } });
    expect(await saveAddress(ADDR)).toMatchObject({ ok: true, synced: false, warning: expect.any(String) });
    install({ upsertThrows: true });
    expect(await saveAddress(ADDR)).toMatchObject({ ok: true, synced: false });
    expect(useProfile.getState().address?.street).toBe('Rua da Lama');
  });

  it('invalid input saves nothing', async () => {
    const calls = install();
    expect(await saveAddress({ ...ADDR, street: '' })).toMatchObject({ ok: false });
    expect(calls).toEqual([]);
    expect(useProfile.getState().address).toBeUndefined();
  });
});

describe('fetchAddress', () => {
  it('maps the row, null without session, throws on error', async () => {
    const row = { cep: '29060000', street: 'R', number: '1', complement: null, district: 'D', city: 'C', uf: 'ES', lat: -20.3, lng: -40.3 };
    const calls = install({ row });
    expect(await fetchAddress()).toEqual({ cep: '29060000', street: 'R', number: '1', district: 'D', city: 'C', uf: 'ES', lat: -20.3, lng: -40.3 });
    expect(calls[0]).toEqual(['select', expect.objectContaining({ table: 'profile_addresses', col: 'user_id', val: 'u1' })]);
    install({ session: null });
    expect(await fetchAddress()).toBeNull();
    install({ selectError: { message: 'x' } });
    await expect(fetchAddress()).rejects.toEqual({ message: 'x' });
  });
});

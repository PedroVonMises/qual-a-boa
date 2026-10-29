import type { SupabaseClient } from '@supabase/supabase-js';

import {
  DISPLAY_NAME_MAX,
  deleteAccountRemote,
  fetchDisplayName,
  normalizeDisplayName,
  saveDisplayName,
  validateDisplayName,
} from './account';
import { setSupabase } from './supabaseClient';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/env', () => ({ env: { dataSource: 'supabase', supabaseUrl: 'http://x', supabaseAnonKey: 'k' } }));

type Err = { message: string } | null;
interface Opts {
  session?: string | null;
  profile?: { display_name: string | null } | null;
  selectError?: Err;
  upsertError?: Err;
  invokeError?: Err;
  invokeThrows?: boolean;
  signOutThrows?: boolean;
}

function install(o: Opts = {}) {
  const calls: Array<[string, unknown]> = [];
  const auth = {
    getSession: async () => ({ data: { session: o.session === null ? null : { user: { id: o.session ?? 'u1' } } } }),
    signInAnonymously: async () => ({ data: { user: null }, error: { message: 'disabled' } }),
    signOut: async (a: unknown) => {
      calls.push(['signOut', a]);
      if (o.signOutThrows) throw new Error('offline');
      return { error: null };
    },
  };
  const from = (table: string) => ({
    select: (cols: string) => ({
      eq: (col: string, val: unknown) => ({
        maybeSingle: async () => {
          calls.push(['select', { table, cols, col, val }]);
          return { data: o.profile ?? null, error: o.selectError ?? null };
        },
      }),
    }),
    upsert: async (row: unknown, opts: unknown) => {
      calls.push(['upsert', { table, row, opts }]);
      return { error: o.upsertError ?? null };
    },
  });
  const functions = {
    invoke: async (name: string, opts: unknown) => {
      calls.push(['invoke', { name, opts }]);
      if (o.invokeThrows) throw new Error('network');
      return { data: null, error: o.invokeError ?? null };
    },
  };
  setSupabase({ auth, from, functions } as unknown as SupabaseClient);
  return calls;
}

afterEach(() => setSupabase(null));

describe('display name', () => {
  it('collapses whitespace and validates length', () => {
    expect(normalizeDisplayName('  Ana   Paula \n')).toBe('Ana Paula');
    expect(validateDisplayName('  Ana  ')).toEqual({ ok: true, name: 'Ana' });
    expect(validateDisplayName('   ')).toEqual({ ok: false, error: 'Digite um nome.' });
    expect(validateDisplayName('x'.repeat(DISPLAY_NAME_MAX)).ok).toBe(true);
    expect(validateDisplayName('x'.repeat(DISPLAY_NAME_MAX + 1))).toEqual({
      ok: false,
      error: `Use até ${DISPLAY_NAME_MAX} caracteres.`,
    });
  });

  it('reads the saved name for the signed-in profile only', async () => {
    const calls = install({ profile: { display_name: 'Ana' } });
    expect(await fetchDisplayName()).toBe('Ana');
    expect(calls[0]).toEqual(['select', { table: 'profiles', cols: 'display_name', col: 'id', val: 'u1' }]);
  });

  it('returns null without a session instead of signing in just to read', async () => {
    const calls = install({ session: null });
    expect(await fetchDisplayName()).toBeNull();
    expect(calls).toEqual([]);
  });

  it('returns null when no profile row exists yet, and throws on a query error', async () => {
    install({ profile: null });
    expect(await fetchDisplayName()).toBeNull();
    install({ selectError: { message: 'rls' } });
    await expect(fetchDisplayName()).rejects.toEqual({ message: 'rls' });
  });

  it('upserts the profile row keyed by the caller id', async () => {
    const calls = install();
    expect(await saveDisplayName('  Ana   Paula ')).toEqual({ ok: true });
    expect(calls).toEqual([['upsert', { table: 'profiles', row: { id: 'u1', display_name: 'Ana Paula' }, opts: { onConflict: 'id' } }]]);
  });

  it('does not call the backend for an invalid name', async () => {
    const calls = install();
    expect((await saveDisplayName('   ')).ok).toBe(false);
    expect(calls).toEqual([]);
  });

  it('reports a failed save without leaking the raw error', async () => {
    install({ upsertError: { message: 'permission denied for table profiles' } });
    const res = await saveDisplayName('Ana');
    expect(res.ok).toBe(false);
    expect(JSON.stringify(res)).not.toContain('permission denied');
  });
});

describe('deleteAccountRemote', () => {
  it('invokes the delete-account function, then drops the local session', async () => {
    const calls = install();
    expect(await deleteAccountRemote()).toEqual({ ok: true });
    expect(calls).toEqual([
      ['invoke', { name: 'delete-account', opts: { method: 'POST' } }],
      ['signOut', { scope: 'local' }],
    ]);
  });

  it('keeps the session and reports failure when the function errors', async () => {
    const calls = install({ invokeError: { message: 'FunctionsHttpError' } });
    const res = await deleteAccountRemote();
    expect(res.ok).toBe(false);
    expect(calls.map((c) => c[0])).toEqual(['invoke']);
  });

  it('treats a network throw as a failure that changed nothing', async () => {
    const calls = install({ invokeThrows: true });
    expect((await deleteAccountRemote()).ok).toBe(false);
    expect(calls.map((c) => c[0])).toEqual(['invoke']);
  });

  it('still succeeds when clearing the local session throws (the account is already gone)', async () => {
    install({ signOutThrows: true });
    expect(await deleteAccountRemote()).toEqual({ ok: true });
  });

  it('fails cleanly with no backend configured', async () => {
    setSupabase(null);
    jest.resetModules();
    jest.doMock('@/lib/env', () => ({ env: { dataSource: 'seed', supabaseUrl: '', supabaseAnonKey: '' } }));
    const fresh = require('./account') as typeof import('./account');
    expect((await fresh.deleteAccountRemote()).ok).toBe(false);
    expect((await fresh.saveDisplayName('Ana')).ok).toBe(false);
    expect(await fresh.fetchDisplayName()).toBeNull();
  });
});

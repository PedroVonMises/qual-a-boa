import type { SupabaseClient } from '@supabase/supabase-js';

import {
  authAvailable,
  confirmEmailCode,
  isValidCode,
  isValidEmail,
  normalizeCode,
  normalizeEmail,
  requestEmailCode,
  signOut,
} from './auth';
import { setSupabase } from './supabaseClient';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/env', () => ({ env: { dataSource: 'supabase', supabaseUrl: 'http://x', supabaseAnonKey: 'k' } }));

type AuthError = { code?: string; message: string; status?: number } | null;
interface FakeAuth {
  user: { is_anonymous?: boolean } | null;
  updateUser?: AuthError;
  signInWithOtp?: AuthError;
  verifyOtp?: AuthError;
}

function install(f: FakeAuth) {
  const calls: Array<[string, unknown]> = [];
  const auth = {
    getUser: async () => ({ data: { user: f.user }, error: null }),
    updateUser: async (a: unknown) => (calls.push(['updateUser', a]), { error: f.updateUser ?? null }),
    signInWithOtp: async (a: unknown) => (calls.push(['signInWithOtp', a]), { error: f.signInWithOtp ?? null }),
    verifyOtp: async (a: unknown) => (calls.push(['verifyOtp', a]), { error: f.verifyOtp ?? null }),
    signOut: async () => (calls.push(['signOut', null]), { error: null }),
  };
  setSupabase({ auth } as unknown as SupabaseClient);
  return calls;
}

afterEach(() => setSupabase(null));

describe('input helpers', () => {
  it('validates and normalizes emails', () => {
    expect(normalizeEmail('  Ana@Exemplo.COM ')).toBe('ana@exemplo.com');
    expect(isValidEmail('ana@exemplo.com')).toBe(true);
    expect(isValidEmail('ana@exemplo')).toBe(false);
    expect(isValidEmail('ana exemplo.com')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });

  it('keeps digits only and requires at least 6', () => {
    expect(normalizeCode('12 34-56')).toBe('123456');
    expect(normalizeCode('1234567890123')).toBe('1234567890');
    expect(isValidCode('12345')).toBe(false);
    expect(isValidCode('123 456')).toBe(true);
  });
});

describe('requestEmailCode', () => {
  it('is available only with the remote backend', () => {
    expect(authAvailable()).toBe(true);
  });

  it('upgrades an anonymous visitor in place with updateUser', async () => {
    const calls = install({ user: { is_anonymous: true } });
    expect(await requestEmailCode(' Ana@Exemplo.com ')).toEqual({ ok: true, mode: 'link' });
    expect(calls).toEqual([['updateUser', { email: 'ana@exemplo.com' }]]);
  });

  it('falls back to signing in when the email already has an account', async () => {
    const calls = install({ user: { is_anonymous: true }, updateUser: { code: 'email_exists', message: 'taken' } });
    expect(await requestEmailCode('ana@exemplo.com')).toEqual({ ok: true, mode: 'signin' });
    expect(calls.map((c) => c[0])).toEqual(['updateUser', 'signInWithOtp']);
  });

  it('signs in with a code when there is no anonymous session', async () => {
    const calls = install({ user: null });
    expect(await requestEmailCode('ana@exemplo.com')).toEqual({ ok: true, mode: 'signin' });
    expect(calls).toEqual([['signInWithOtp', { email: 'ana@exemplo.com', options: { shouldCreateUser: true } }]]);
  });

  it('rejects an invalid email without calling the backend', async () => {
    const calls = install({ user: null });
    const res = await requestEmailCode('nope');
    expect(res.ok).toBe(false);
    expect(calls).toEqual([]);
  });

  it('maps rate limits to a friendly message', async () => {
    install({ user: null, signInWithOtp: { code: 'over_email_send_rate_limit', message: 'x', status: 429 } });
    expect(await requestEmailCode('ana@exemplo.com')).toEqual({
      ok: false,
      error: 'Muitas tentativas. Aguarde um minuto e tente de novo.',
    });
  });

  it('does not leak raw backend messages', async () => {
    install({ user: null, signInWithOtp: { message: 'smtp exploded at 10.0.0.4' } });
    const res = await requestEmailCode('ana@exemplo.com');
    expect(res).toEqual({ ok: false, error: expect.not.stringContaining('smtp') });
  });

  it('fails cleanly with no backend', async () => {
    setSupabase(null);
    jest.resetModules();
    jest.doMock('@/lib/env', () => ({ env: { dataSource: 'seed', supabaseUrl: '', supabaseAnonKey: '' } }));
    const fresh = require('./auth') as typeof import('./auth');
    const res = await fresh.requestEmailCode('ana@exemplo.com');
    expect(res.ok).toBe(false);
    expect(fresh.authAvailable()).toBe(false);
  });
});

describe('confirmEmailCode', () => {
  it('verifies with email_change when linking and email when signing in', async () => {
    let calls = install({ user: null });
    expect(await confirmEmailCode('Ana@Exemplo.com', '123 456', 'link')).toEqual({ ok: true });
    expect(calls).toEqual([['verifyOtp', { email: 'ana@exemplo.com', token: '123456', type: 'email_change' }]]);
    calls = install({ user: null });
    await confirmEmailCode('ana@exemplo.com', '123456', 'signin');
    expect(calls[0][1]).toMatchObject({ type: 'email' });
  });

  it('rejects short codes locally', async () => {
    const calls = install({ user: null });
    expect((await confirmEmailCode('ana@exemplo.com', '123', 'signin')).ok).toBe(false);
    expect(calls).toEqual([]);
  });

  it('reports an expired or wrong code', async () => {
    install({ user: null, verifyOtp: { code: 'otp_expired', message: 'x' } });
    expect(await confirmEmailCode('ana@exemplo.com', '123456', 'signin')).toEqual({
      ok: false,
      error: 'O código expirou ou está incorreto. Peça um novo.',
    });
  });
});

describe('signOut', () => {
  it('signs out of the shared client', async () => {
    const calls = install({ user: null });
    await signOut();
    expect(calls).toEqual([['signOut', null]]);
  });
});

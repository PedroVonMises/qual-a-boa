import type { SupabaseClient } from '@supabase/supabase-js';

import { SIGN_IN_COOLDOWN_MS, ensureUserId, setSupabase } from './supabaseClient';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('@/lib/env', () => ({ env: { dataSource: 'supabase', supabaseUrl: 'http://x', supabaseAnonKey: 'k' } }));

function install(opts: { session?: string | null; signIn: () => Promise<{ data: { user: { id: string } | null }; error: unknown }> }) {
  const signInAnonymously = jest.fn(opts.signIn);
  const auth = {
    getSession: async () => ({ data: { session: opts.session ? { user: { id: opts.session } } : null } }),
    signInAnonymously,
  };
  setSupabase({ auth } as unknown as SupabaseClient);
  return signInAnonymously;
}

afterEach(() => {
  setSupabase(null);
  jest.restoreAllMocks();
});

describe('ensureUserId', () => {
  it('returns the persisted session without signing in', async () => {
    const signIn = install({ session: 'u1', signIn: async () => ({ data: { user: null }, error: null }) });
    expect(await ensureUserId()).toBe('u1');
    expect(signIn).not.toHaveBeenCalled();
  });

  it('signs in anonymously when there is no session', async () => {
    const signIn = install({ signIn: async () => ({ data: { user: { id: 'anon-1' } }, error: null }) });
    expect(await ensureUserId()).toBe('anon-1');
    expect(signIn).toHaveBeenCalledTimes(1);
  });

  it('does not hammer the network while sign-in keeps failing, then retries after the cooldown', async () => {
    let now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    const signIn = install({ signIn: async () => ({ data: { user: null }, error: { message: 'anonymous_provider_disabled' } }) });

    expect(await ensureUserId()).toBeNull();
    expect(await ensureUserId()).toBeNull();
    expect(await ensureUserId()).toBeNull();
    expect(signIn).toHaveBeenCalledTimes(1);

    now += SIGN_IN_COOLDOWN_MS + 1;
    expect(await ensureUserId()).toBeNull();
    expect(signIn).toHaveBeenCalledTimes(2);
  });

  it('also backs off after a thrown (offline) sign-in', async () => {
    const signIn = install({
      signIn: async () => {
        throw new Error('network');
      },
    });
    expect(await ensureUserId()).toBeNull();
    expect(await ensureUserId()).toBeNull();
    expect(signIn).toHaveBeenCalledTimes(1);
  });
});

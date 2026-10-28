import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { env } from '@/lib/env';

/** True when the app is configured for the Supabase backend (EXPO_PUBLIC_DATA_SOURCE=supabase). */
export const isRemote = () => env.dataSource === 'supabase' && !!env.supabaseUrl && !!env.supabaseAnonKey;

/** After a failed anonymous sign-in (provider disabled, offline), stay local-only this long before retrying. */
export const SIGN_IN_COOLDOWN_MS = 60_000;

let client: SupabaseClient | null = null;
let pending: Promise<string | null> | null = null;
let retryAfter = 0;

/** Shared client with the session persisted in AsyncStorage. Null when running on seed data. */
export function getSupabase(): SupabaseClient | null {
  if (!isRemote()) return null;
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { storage: AsyncStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
  }
  return client;
}

/** Test hook: inject or reset the shared client. */
export function setSupabase(next: SupabaseClient | null): void {
  client = next;
  pending = null;
  retryAfter = 0;
}

/**
 * Returns the current user id, signing in anonymously on first use (anonymous sign-ins must be enabled in the
 * Supabase project). Null when offline, on seed data, or when sign-in fails; callers then stay local-only.
 */
export function ensureUserId(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return Promise.resolve(null);
  pending ??= (async () => {
    try {
      const { data } = await sb.auth.getSession();
      if (data.session) return data.session.user.id;
      if (Date.now() < retryAfter) return null;
      const res = await sb.auth.signInAnonymously();
      const id = res.data.user?.id ?? null;
      if (!id) retryAfter = Date.now() + SIGN_IN_COOLDOWN_MS;
      return id;
    } catch {
      retryAfter = Date.now() + SIGN_IN_COOLDOWN_MS;
      return null;
    } finally {
      pending = null;
    }
  })();
  return pending;
}

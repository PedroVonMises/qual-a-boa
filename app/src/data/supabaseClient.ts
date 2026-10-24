import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { env } from '@/lib/env';

/** True when the app is configured for the Supabase backend (EXPO_PUBLIC_DATA_SOURCE=supabase). */
export const isRemote = () => env.dataSource === 'supabase' && !!env.supabaseUrl && !!env.supabaseAnonKey;

let client: SupabaseClient | null = null;
let pending: Promise<string | null> | null = null;

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
      const res = await sb.auth.signInAnonymously();
      return res.data.user?.id ?? null;
    } catch {
      return null;
    } finally {
      pending = null;
    }
  })();
  return pending;
}

import type { SupabaseClient } from '@supabase/supabase-js';

import { ensureUserId, getSupabase, isRemote } from '../supabaseClient';

export type PushResult = 'synced' | 'rejected' | 'failed' | 'skipped';

interface PgError {
  code?: string;
  message?: string;
}

/** Postgres codes meaning "the server said no" (RLS 42501, check-in window / throttle 23514). Retrying cannot help. */
const REJECT_CODES = new Set(['42501', '23514']);
export const isRejection = (e: PgError | null | undefined) =>
  !!e && (REJECT_CODES.has(e.code ?? '') || /row-level security|throttled/i.test(e.message ?? ''));
export const isDuplicate = (e: PgError | null | undefined) => e?.code === '23505';

export function warn(label: string, e: unknown): void {
  if (__DEV__) console.warn(`[sync] ${label}`, e);
}

/** The authed client, or null when not remote / not signed in (callers then stay local-only). */
export async function authedClient(): Promise<SupabaseClient | null> {
  if (!isRemote()) return null;
  const sb = getSupabase();
  if (!sb) return null;
  return (await ensureUserId()) ? sb : null;
}

/** Resolves once a persisted zustand store finished rehydrating (so a pull is not overwritten by storage). */
export function whenHydrated(store: {
  persist: { hasHydrated: () => boolean; onFinishHydration: (fn: () => void) => () => void };
}): Promise<void> {
  if (store.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const off = store.persist.onFinishHydration(() => {
      off();
      resolve();
    });
  });
}

/** Runs a push body; never throws, warns in dev. */
export async function safely(label: string, fn: (sb: SupabaseClient) => Promise<PushResult>): Promise<PushResult> {
  try {
    const sb = await authedClient();
    if (!sb) return 'skipped';
    return await fn(sb);
  } catch (e) {
    warn(label, e);
    return 'failed';
  }
}

import { useQuery } from '@tanstack/react-query';

import type { AuthResult } from './auth';
import { ensureUserId, getSupabase, isRemote } from './supabaseClient';

export const DISPLAY_NAME_MAX = 40;

const NO_BACKEND = 'A conta ainda não está disponível neste app.';
const SAVE_FAILED = 'Não foi possível salvar agora. Tente de novo em instantes.';
const DELETE_FAILED = 'Não foi possível apagar a conta agora. Tente de novo em instantes: a exclusão continua de onde parou.';

export const displayNameKey = ['remote', 'profile', 'display-name'] as const;

export const normalizeDisplayName = (raw: string) => raw.replace(/\s+/g, ' ').trim();

export function validateDisplayName(raw: string): { ok: true; name: string } | { ok: false; error: string } {
  const name = normalizeDisplayName(raw);
  if (!name) return { ok: false, error: 'Digite um nome.' };
  if (name.length > DISPLAY_NAME_MAX) return { ok: false, error: `Use até ${DISPLAY_NAME_MAX} caracteres.` };
  return { ok: true, name };
}

/** The signed-in profile's display name, or null (not remote, no session, or never set). Throws on network/RLS errors. */
export async function fetchDisplayName(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  // Read the existing session only: a read must not trigger an anonymous sign-in.
  const uid = (await sb.auth.getSession()).data.session?.user.id;
  if (!uid) return null;
  const { data, error } = await sb.from('profiles').select('display_name').eq('id', uid).maybeSingle();
  if (error) throw error;
  return (data as { display_name: string | null } | null)?.display_name ?? null;
}

/** Creates or updates the caller's profile row (RLS limits it to their own id). Never throws. */
export async function saveDisplayName(raw: string): Promise<AuthResult> {
  const check = validateDisplayName(raw);
  if (!check.ok) return check;
  try {
    const sb = getSupabase();
    if (!sb) return { ok: false, error: NO_BACKEND };
    const uid = await ensureUserId();
    if (!uid) return { ok: false, error: SAVE_FAILED };
    const { error } = await sb.from('profiles').upsert({ id: uid, display_name: check.name }, { onConflict: 'id' });
    return error ? { ok: false, error: SAVE_FAILED } : { ok: true };
  } catch {
    return { ok: false, error: SAVE_FAILED };
  }
}

/**
 * Erases the account on the server through the `delete-account` Edge Function (files, then the auth user; every
 * table cascades). On success the local session is dropped too. Never throws; on failure nothing is removed.
 */
export async function deleteAccountRemote(): Promise<AuthResult> {
  try {
    const sb = getSupabase();
    if (!sb) return { ok: false, error: NO_BACKEND };
    const { error } = await sb.functions.invoke('delete-account', { method: 'POST' });
    if (error) return { ok: false, error: DELETE_FAILED };
    try {
      // The user no longer exists server-side, so skip the revoke call and just clear the stored session.
      await sb.auth.signOut({ scope: 'local' });
    } catch {
      // Storage cleanup only; the account is already gone.
    }
    return { ok: true };
  } catch {
    return { ok: false, error: DELETE_FAILED };
  }
}

/** The profile display name for headers. Cached per session; null for visitors and seed-data builds. */
export function useDisplayName() {
  return useQuery({ queryKey: displayNameKey, queryFn: fetchDisplayName, enabled: isRemote(), staleTime: 5 * 60_000 });
}

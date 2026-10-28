import { useEffect, useState } from 'react';

import { getSupabase, isRemote } from './supabaseClient';

/** Email login needs the Supabase backend; on seed/feed data there is nothing to sign in to. */
export const authAvailable = () => isRemote();

export type AuthMode = 'link' | 'signin';
export type AuthResult = { ok: true } | { ok: false; error: string };
export type CodeRequest = { ok: true; mode: AuthMode } | { ok: false; error: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const normalizeEmail = (raw: string) => raw.trim().toLowerCase();
export const isValidEmail = (raw: string) => EMAIL_RE.test(normalizeEmail(raw));

/** Supabase email codes are numeric, 6 digits by default and up to 10 when configured. */
export const normalizeCode = (raw: string) => raw.replace(/\D/g, '').slice(0, 10);
export const isValidCode = (raw: string) => normalizeCode(raw).length >= 6;

const NO_BACKEND = 'O login ainda não está disponível neste app.';
const GENERIC = 'Não foi possível concluir agora. Tente de novo em instantes.';

function friendly(error: { code?: string; message?: string; status?: number } | null | undefined): string {
  switch (error?.code) {
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Muitas tentativas. Aguarde um minuto e tente de novo.';
    case 'otp_expired':
      return 'O código expirou ou está incorreto. Peça um novo.';
    case 'email_address_invalid':
      return 'Esse e-mail não parece válido.';
    default:
      return error?.status === 429 ? 'Muitas tentativas. Aguarde um minuto e tente de novo.' : GENERIC;
  }
}

/**
 * Sends a one-time code to the email. An anonymous visitor is upgraded in place (`updateUser`), so favorites, follows
 * and reviews keep their owner id. If the email already belongs to an account we sign in to that account instead.
 */
export async function requestEmailCode(rawEmail: string): Promise<CodeRequest> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: NO_BACKEND };
  const email = normalizeEmail(rawEmail);
  if (!isValidEmail(email)) return { ok: false, error: 'Esse e-mail não parece válido.' };
  try {
    const { data } = await sb.auth.getUser();
    if (data.user?.is_anonymous) {
      const res = await sb.auth.updateUser({ email });
      if (!res.error) return { ok: true, mode: 'link' };
      if (res.error.code !== 'email_exists') return { ok: false, error: friendly(res.error) };
    }
    const res = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    return res.error ? { ok: false, error: friendly(res.error) } : { ok: true, mode: 'signin' };
  } catch {
    return { ok: false, error: GENERIC };
  }
}

/** Confirms the code from `requestEmailCode`; `mode` selects the matching Supabase OTP type. */
export async function confirmEmailCode(rawEmail: string, rawCode: string, mode: AuthMode): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: NO_BACKEND };
  if (!isValidCode(rawCode)) return { ok: false, error: 'Digite o código de 6 dígitos que enviamos.' };
  try {
    const res = await sb.auth.verifyOtp({
      email: normalizeEmail(rawEmail),
      token: normalizeCode(rawCode),
      type: mode === 'link' ? 'email_change' : 'email',
    });
    return res.error ? { ok: false, error: friendly(res.error) } : { ok: true };
  } catch {
    return { ok: false, error: GENERIC };
  }
}

/** Signs out; the next sync call starts a fresh anonymous session via `ensureUserId`. */
export async function signOut(): Promise<void> {
  try {
    await getSupabase()?.auth.signOut();
  } catch {
    // Offline: the local session is cleared by supabase-js regardless.
  }
}

/** The signed-in (non-anonymous) account email, or null for visitors and seed-data builds. */
export function useAccountEmail(): string | null {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let alive = true;
    const apply = (user: { email?: string; is_anonymous?: boolean } | null | undefined) =>
      alive && setEmail(user && !user.is_anonymous ? (user.email ?? null) : null);
    void sb.auth.getUser().then(({ data }) => apply(data.user));
    const { data } = sb.auth.onAuthStateChange((_event, session) => apply(session?.user));
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);
  return email;
}

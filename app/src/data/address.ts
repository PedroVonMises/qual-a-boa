import { useQuery, useQueryClient } from '@tanstack/react-query';

import { isValidCep, normalizeCep } from '@/lib/cep';
import { useProfile, type ProfileAddress } from '@/state/profile';
import { getSupabase, isRemote } from './supabaseClient';

export const addressKey = ['remote', 'profile', 'address'] as const;

const SYNC_FAILED = 'Endereço salvo neste aparelho. Não deu para enviar à sua conta agora.';

interface AddressRow {
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  district: string;
  city: string;
  uf: string;
  lat: number | null;
  lng: number | null;
}

export type AddressValidation = { ok: true; address: ProfileAddress } | { ok: false; error: string };

/** Trims fields and checks what the server will enforce (CEP 8 digits, UF 2 letters, required fields). */
export function validateAddress(a: ProfileAddress): AddressValidation {
  const t = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
  const address: ProfileAddress = {
    cep: normalizeCep(a.cep),
    street: t(a.street),
    number: t(a.number),
    district: t(a.district),
    city: t(a.city),
    uf: t(a.uf).toUpperCase(),
    lat: a.lat,
    lng: a.lng,
    ...(t(a.complement) ? { complement: t(a.complement) } : {}),
  };
  if (!isValidCep(address.cep)) return { ok: false, error: 'Digite um CEP com 8 números.' };
  if (!address.street) return { ok: false, error: 'Digite a rua.' };
  if (!address.number) return { ok: false, error: 'Digite o número (ou "s/n").' };
  if (!address.district) return { ok: false, error: 'Digite o bairro.' };
  if (!address.city) return { ok: false, error: 'Digite a cidade.' };
  if (!/^[A-Z]{2}$/.test(address.uf)) return { ok: false, error: 'Use a sigla do estado, como ES.' };
  if (!Number.isFinite(address.lat) || !Number.isFinite(address.lng)) return { ok: false, error: 'Não achamos esse endereço no mapa.' };
  return { ok: true, address };
}

const toRow = (a: ProfileAddress) => ({
  cep: a.cep,
  street: a.street,
  number: a.number,
  complement: a.complement ?? null,
  district: a.district,
  city: a.city,
  uf: a.uf,
  lat: a.lat,
  lng: a.lng,
  updated_at: new Date().toISOString(),
});

function fromRow(r: AddressRow): ProfileAddress | null {
  if (r.lat === null || r.lng === null) return null;
  return {
    cep: r.cep,
    street: r.street,
    number: r.number,
    district: r.district,
    city: r.city,
    uf: r.uf,
    lat: r.lat,
    lng: r.lng,
    ...(r.complement ? { complement: r.complement } : {}),
  };
}

async function sessionUserId(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  // Existing session only: reading or saving an address never creates an anonymous account.
  return (await sb.auth.getSession()).data.session?.user.id ?? null;
}

/** The signed-in user's address from the server, or null (not remote, no session, no row). Throws on network/RLS errors. */
export async function fetchAddress(): Promise<ProfileAddress | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const uid = await sessionUserId();
  if (!uid) return null;
  const { data, error } = await sb
    .from('profile_addresses')
    .select('cep, street, number, complement, district, city, uf, lat, lng')
    .eq('user_id', uid)
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as AddressRow) : null;
}

export type SaveAddressResult =
  | { ok: true; synced: boolean; warning?: string }
  | { ok: false; error: string };

/**
 * Local-first: always saves to the profile store (which also sets the registered location), then upserts to
 * `profile_addresses` when the app is remote and signed in. Never throws.
 */
export async function saveAddress(input: ProfileAddress): Promise<SaveAddressResult> {
  const check = validateAddress(input);
  if (!check.ok) return check;
  useProfile.getState().setAddress(check.address);
  if (!isRemote()) return { ok: true, synced: false };
  try {
    const sb = getSupabase();
    const uid = await sessionUserId();
    if (!sb || !uid) return { ok: true, synced: false };
    const { error } = await sb.from('profile_addresses').upsert({ user_id: uid, ...toRow(check.address) }, { onConflict: 'user_id' });
    return error ? { ok: true, synced: false, warning: SYNC_FAILED } : { ok: true, synced: true };
  } catch {
    return { ok: true, synced: false, warning: SYNC_FAILED };
  }
}

/**
 * The address to show: the server copy when signed in (it also fills an empty local store), else the local one.
 */
export function useAddress() {
  const local = useProfile((s) => s.address);
  const query = useQuery({
    queryKey: addressKey,
    enabled: isRemote(),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const remote = await fetchAddress();
      if (remote && !useProfile.getState().address) useProfile.getState().setAddress(remote);
      return remote;
    },
  });
  return { ...query, address: local ?? query.data ?? null };
}

/** Saves and refreshes the cached server copy. */
export function useSaveAddress() {
  const qc = useQueryClient();
  return async (a: ProfileAddress) => {
    const res = await saveAddress(a);
    if (res.ok && res.synced) await qc.invalidateQueries({ queryKey: addressKey });
    return res;
  };
}

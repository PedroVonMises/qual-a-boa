import type { QueryClient } from '@tanstack/react-query';

import { addressKey } from '@/data/address';
import { getSupabase, isRemote } from '@/data/supabaseClient';
import { useProfile } from '@/state/profile';

export type DeleteAddressResult = { ok: true; warning?: string };

const DELETE_FAILED = 'Endereço apagado deste aparelho. Não deu para apagar da sua conta agora.';

/**
 * Clears the address locally (and the registered location), then deletes the server row when signed in.
 * Never throws. TODO(data owner): move next to saveAddress in data/address.ts.
 */
export async function deleteAddress(client?: QueryClient): Promise<DeleteAddressResult> {
  useProfile.getState().clearAddress();
  client?.setQueryData(addressKey, null);
  if (!isRemote()) return { ok: true };
  try {
    const sb = getSupabase();
    const uid = sb ? (await sb.auth.getSession()).data.session?.user.id : null;
    if (!sb || !uid) return { ok: true };
    const { error } = await sb.from('profile_addresses').delete().eq('user_id', uid);
    return error ? { ok: true, warning: DELETE_FAILED } : { ok: true };
  } catch {
    return { ok: true, warning: DELETE_FAILED };
  }
}

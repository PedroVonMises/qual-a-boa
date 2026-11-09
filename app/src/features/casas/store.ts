import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { useMyVenueAccounts } from '@/data/casas';
import type { ProposedVenue, VenueAccount } from '@/domain/casas';
import { EMPTY_FESTA, type CompanyForm, type FestaDraft } from './format';

/** The casa picked in step 1: a catalog venue or a new one. */
export type VenueChoice =
  | { kind: 'catalog'; id: string; name: string; area: string }
  | { kind: 'new'; proposed: ProposedVenue };

export type { CompanyForm } from './format';

export const EMPTY_COMPANY: CompanyForm = { cnpj: '', legalName: '', contactName: '', whatsapp: '', responsible: false };

interface FlowState {
  venue: VenueChoice | null;
  company: CompanyForm;
  /** Set once claim_venue succeeds, so a retry of the payment does not claim twice. */
  claimedId: string | null;
  /** Casa shown by the panel and the subscription screen when the user has more than one. */
  accountId: string | null;
  setVenue: (v: VenueChoice) => void;
  setCompany: (c: CompanyForm) => void;
  setClaimed: (id: string) => void;
  selectAccount: (id: string) => void;
  reset: () => void;
}

/** Sign-up flow across the three Vincular screens (memory only: CNPJ and contact data are not kept on the device). */
export const useCasasFlow = create<FlowState>()((set) => ({
  venue: null,
  company: EMPTY_COMPANY,
  claimedId: null,
  accountId: null,
  // Changing the casa or the company after a claim starts a new claim.
  setVenue: (venue) => set({ venue, claimedId: null }),
  setCompany: (company) => set({ company, claimedId: null }),
  setClaimed: (id) => set({ claimedId: id, accountId: id }),
  selectAccount: (id) => set({ accountId: id }),
  reset: () => set({ venue: null, company: EMPTY_COMPANY, claimedId: null, accountId: null }),
}));

interface DraftState {
  /** Unsent festa per casa account id. */
  drafts: Record<string, FestaDraft>;
  saveDraft: (accountId: string, d: FestaDraft) => void;
  clearDraft: (accountId: string) => void;
}

/** "Salvar rascunho": local only, per casa. The poster file is not kept (its uri may expire). */
export const useFestaDrafts = create<DraftState>()(
  persist(
    (set) => ({
      drafts: {},
      saveDraft: (accountId, d) => set((s) => ({ drafts: { ...s.drafts, [accountId]: { ...d, poster: null } } })),
      clearDraft: (accountId) =>
        set((s) => {
          const { [accountId]: _drop, ...rest } = s.drafts;
          return { drafts: rest };
        }),
    }),
    { name: 'qab.casasDrafts', storage: createJSONStorage(() => AsyncStorage), version: 1 },
  ),
);

export const draftFor = (drafts: Record<string, FestaDraft>, accountId: string | undefined): FestaDraft | null =>
  accountId && drafts[accountId] ? { ...EMPTY_FESTA, ...drafts[accountId] } : null;

/**
 * The casa account the screens act on: the one picked in this session, else the first verified, else the first.
 * Keeps the last list while a new query key loads (the demo store re-keys the query on every change), so forms
 * are not unmounted by a refetch. `loading` is true only before the first answer.
 */
export function useCurrentAccount() {
  const q = useMyVenueAccounts();
  const preferred = useCasasFlow((s) => s.accountId);
  const [last, setLast] = useState<VenueAccount[] | undefined>(q.data);
  if (q.data && q.data !== last) setLast(q.data);
  const accounts = q.data ?? last ?? [];
  const account =
    accounts.find((a) => a.id === preferred) ?? accounts.find((a) => a.status === 'verified') ?? accounts[0] ?? null;
  return { query: q, loading: q.isPending && !last, failed: q.isError && !last, accounts, account };
}

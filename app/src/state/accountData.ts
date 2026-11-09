import { useCheckins } from './checkins';
import { resetApp } from './demo';
import { useFavorites } from './favorites';
import { useFollows } from './follows';
import { useProfile } from './profile';
import { useReviews } from './reviews';
import { useSupport } from './support';
import { useTaste } from './taste';

export interface ExportAccount {
  email: string | null;
  displayName: string | null;
}

/**
 * Everything the app holds about the user, for "Exportar meus dados" (LGPD). The stores are local-first and
 * synced with the account, so this is the user's complete data, including the registered phone/address;
 * device-only caches (filters, the live location) are not personal records and are left out.
 */
export function buildExport(account: ExportAccount, now: Date = new Date()) {
  const fav = useFavorites.getState();
  const profile = useProfile.getState();
  return {
    app: 'Qual a boa?',
    exportedAt: now.toISOString(),
    account,
    favorites: { events: fav.eventIds, venues: fav.venueIds, artists: fav.artistSlugs },
    following: Object.values(useFollows.getState().follows),
    checkins: useCheckins.getState().checkins,
    reviews: useReviews.getState().mine,
    supportTickets: useSupport.getState().tickets,
    profile: { phone: profile.phone ?? null, address: profile.address ?? null },
  };
}

export const exportFileName = (now: Date = new Date()) => `qual-a-boa-meus-dados-${now.toISOString().slice(0, 10)}.json`;

/** Clears every user-data store, profile (phone/address), the recommendation taste, filters, location and the session. */
export function wipeLocalData(): void {
  resetApp();
  useTaste.getState().reset();
}

import { useFavorites } from '@/state/favorites';

import { getRepo } from '../index';
import { getSupabase } from '../supabaseClient';
import { authedClient, safely, warn, whenHydrated, type PushResult } from './util';

export type FavKind = 'event' | 'venue' | 'artist';

/** Slug <-> uuid bridge for venues/artists (stored by slug locally, by uuid in favorites.ref_id). */
export interface Catalog {
  idForSlug(kind: 'venue' | 'artist', slug: string): Promise<string | null>;
  slugsForIds(kind: 'venue' | 'artist', ids: string[]): Promise<Map<string, string>>;
}

const slugToId = new Map<string, string>();

export const defaultCatalog: Catalog = {
  async idForSlug(kind, slug) {
    const key = `${kind}:${slug}`;
    const hit = slugToId.get(key);
    if (hit) return hit;
    const repo = getRepo();
    const id = kind === 'venue' ? (await repo.getVenue(slug))?.venue.id : (await repo.getArtist(slug))?.artist.id;
    if (id) slugToId.set(key, id);
    return id ?? null;
  },
  async slugsForIds(kind, ids) {
    const out = new Map<string, string>();
    const sb = getSupabase();
    if (!sb || !ids.length) return out;
    const { data, error } = await sb.from(kind === 'venue' ? 'venues' : 'artists').select('id, slug').in('id', ids);
    if (error) throw error;
    for (const r of (data ?? []) as { id: string; slug: string }[]) {
      out.set(r.id, r.slug);
      slugToId.set(`${kind}:${r.slug}`, r.id);
    }
    return out;
  },
};

let catalog: Catalog = defaultCatalog;
/** Test hook. */
export function setCatalog(next: Catalog | null): void {
  catalog = next ?? defaultCatalog;
  slugToId.clear();
}

const refFor = async (kind: FavKind, key: string) => (kind === 'event' ? key : catalog.idForSlug(kind, key));

/** Adds (on=true) or removes a favorite remotely. `key` is the event id or the venue/artist slug. */
export function pushFavorite(kind: FavKind, key: string, on: boolean): Promise<PushResult> {
  return safely('favorite', async (sb) => {
    const ref = await refFor(kind, key);
    if (!ref) return 'failed';
    const res = on
      ? await sb.from('favorites').upsert({ kind, ref_id: ref }, { onConflict: 'user_id,kind,ref_id', ignoreDuplicates: true })
      : await sb.from('favorites').delete().eq('kind', kind).eq('ref_id', ref);
    if (res.error) throw res.error;
    return 'synced';
  });
}

export interface FavState {
  eventIds: string[];
  venueIds: string[];
  artistSlugs: string[];
}

const union = (server: string[], local: string[]) => [...server, ...local.filter((x) => !server.includes(x))];

/** Server wins for rows it has; local-only rows are kept (and reported so the caller can push them). */
export function mergeFavorites(
  local: FavState,
  server: FavState,
): { merged: FavState; localOnly: { kind: FavKind; key: string }[] } {
  const only = (kind: FavKind, l: string[], s: string[]) => l.filter((x) => !s.includes(x)).map((key) => ({ kind, key }));
  return {
    merged: {
      eventIds: union(server.eventIds, local.eventIds),
      venueIds: union(server.venueIds, local.venueIds),
      artistSlugs: union(server.artistSlugs, local.artistSlugs),
    },
    localOnly: [
      ...only('event', local.eventIds, server.eventIds),
      ...only('venue', local.venueIds, server.venueIds),
      ...only('artist', local.artistSlugs, server.artistSlugs),
    ],
  };
}

export async function pullFavorites(): Promise<void> {
  try {
    const sb = await authedClient();
    if (!sb) return;
    const { data, error } = await sb.from('favorites').select('kind, ref_id');
    if (error) throw error;
    const rows = (data ?? []) as { kind: FavKind; ref_id: string }[];
    const ids = (k: FavKind) => rows.filter((r) => r.kind === k).map((r) => r.ref_id);
    const [venues, artists] = await Promise.all([
      catalog.slugsForIds('venue', ids('venue')),
      catalog.slugsForIds('artist', ids('artist')),
    ]);
    const server: FavState = {
      eventIds: ids('event'),
      venueIds: ids('venue').flatMap((id) => venues.get(id) ?? []),
      artistSlugs: ids('artist').flatMap((id) => artists.get(id) ?? []),
    };
    await whenHydrated(useFavorites);
    const { merged, localOnly } = mergeFavorites(useFavorites.getState(), server);
    useFavorites.setState(merged);
    await Promise.all(localOnly.map((l) => pushFavorite(l.kind, l.key, true)));
  } catch (e) {
    warn('pullFavorites', e);
  }
}

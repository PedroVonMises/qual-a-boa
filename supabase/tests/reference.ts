/**
 * Independent TypeScript reading of the search spec, used only to cross-check
 * the SQL implementation. (The app's SeedRepo is a separate implementation.)
 */
import { effectiveTags, matchesTags } from '../../app/src/domain/accessTags';
import type { EventItem, SearchParams, SeedDataset, Venue } from '../../app/src/domain/types';

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const a =
    Math.sin(r(lat2 - lat1) / 2) ** 2 +
    Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function referenceSearch(ds: SeedDataset, p: SearchParams): { ids: string[]; total: number } {
  const now = p.now ?? new Date().toISOString();
  const from = Date.parse(p.dateFrom ?? now);
  const to = p.dateTo ? Date.parse(p.dateTo) : null;
  const venues = new Map(ds.venues.map((v) => [v.id, v]));
  const artists = new Map(ds.artists.map((a) => [a.id, a]));
  const q = p.query?.trim() ? fold(p.query.trim()) : null;
  const genres = p.genreSlugs && p.genreSlugs.length ? p.genreSlugs : null;

  const rows: { e: EventItem; v: Venue; d: number }[] = [];
  for (const e of ds.events) {
    const v = venues.get(e.venueId)!;
    const t = Date.parse(e.startsAt);
    if (e.status !== 'published' || v.status === 'closed') continue;
    if (t < from || (to !== null && t > to)) continue;
    const dist = haversineKm(p.lat, p.lng, v.lat, v.lng);
    if (dist > p.radiusKm) continue;
    if (genres && !e.genreSlugs.some((g) => genres.includes(g))) continue;
    if (!matchesTags(effectiveTags(v, e), p.tags)) continue;
    if (p.priceMax !== undefined && p.priceMax !== null) {
      const ok = e.isFree || (p.priceMax > 0 && e.priceMin !== null && e.priceMin <= p.priceMax);
      if (!ok) continue;
    }
    if (p.artistId && !e.artistIds.includes(p.artistId)) continue;
    if (p.area && v.area.toLowerCase() !== p.area.toLowerCase()) continue;
    if (q) {
      const hit =
        fold(e.title).includes(q) ||
        fold(v.name).includes(q) ||
        e.artistIds.some((id) => fold(artists.get(id)!.name).includes(q));
      if (!hit) continue;
    }
    rows.push({ e, v, d: Math.round(dist * 1000) / 1000 });
  }

  const priceKey = (e: EventItem) => (e.isFree ? 0 : e.priceMin);
  rows.sort((a, b) => {
    let c = 0;
    if (p.sort === 'distance') c = a.d - b.d;
    else if (p.sort === 'price') {
      const pa = priceKey(a.e), pb = priceKey(b.e);
      c = pa === null && pb === null ? 0 : pa === null ? 1 : pb === null ? -1 : pa - pb;
    } else if (p.sort === 'popularity') c = b.e.popularity - a.e.popularity;
    if (c !== 0) return c;
    const t = Date.parse(a.e.startsAt) - Date.parse(b.e.startsAt);
    if (t !== 0) return t;
    return a.e.id < b.e.id ? -1 : a.e.id > b.e.id ? 1 : 0;
  });

  const offset = p.cursor ? Number(p.cursor) : 0;
  const limit = p.limit ?? 20;
  return { ids: rows.slice(offset, offset + limit).map((r) => r.e.id), total: rows.length };
}

// Deterministic ids. Copy of the helpers in supabase/seed/seed-data.ts: the namespaces MUST stay identical
// so ids produced here match the ids the app and the seed generate for the same venue/genre/artist slug.
import { createHash } from 'node:crypto';

/** Deterministic UUID (md5, RFC 4122 v3 layout) derived from a namespaced slug. */
export function uuidFromSlug(key: string): string {
  const h = createHash('md5').update(key).digest('hex').split('');
  h[12] = '3';
  h[16] = ((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16);
  const s = h.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

export const genreId = (slug: string) => uuidFromSlug(`genre:${slug}`);
export const venueId = (slug: string) => uuidFromSlug(`venue:${slug}`);
export const artistId = (slug: string) => uuidFromSlug(`artist:${slug}`);
export const eventId = (key: string) => uuidFromSlug(`event:${key}`);

export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' e ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const shortHash = (s: string, n = 16) => createHash('sha1').update(s).digest('hex').slice(0, n);

/** Genre taxonomy (docs/VENUES.md), display order. Same slugs/labels as the app seed. */
export const GENRES: [slug: string, label: string][] = [
  ['funk', 'Funk'],
  ['pagode-samba', 'Pagode/Samba'],
  ['sertanejo', 'Sertanejo'],
  ['eletronica-house', 'Eletrônica/House'],
  ['pop-hits', 'Pop/Hits'],
  ['rock-indie', 'Rock/Indie'],
  ['metal-punk-goth', 'Metal/Punk/Goth'],
  ['forro-tecnobrega', 'Forró/Tecnobrega'],
  ['hip-hop-rnb', 'Hip-hop/R&B'],
  ['karaoke-ao-vivo', 'Karaokê/Ao vivo'],
];
const ORDER = new Map(GENRES.map(([s], i) => [s, i]));
export const sortGenres = (slugs: string[]) =>
  [...new Set(slugs)].sort((a, b) => (ORDER.get(a) ?? 99) - (ORDER.get(b) ?? 99));

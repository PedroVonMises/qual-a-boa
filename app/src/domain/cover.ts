import type { CoverKey } from './types';

/**
 * Deterministic illustrated cover for an event: `art:<template>:<palette>:<variant>`.
 * Pure (no RN imports) so the seed script can use it. Template and palette ids must match
 * ui/art/templates and ui/art/palettes (checked by tests).
 */
export const COVER_TEMPLATE_IDS = [
  'sol-mare', 'disco', 'raio', 'lua', 'vinil', 'guitarra', 'equalizador', 'galera',
  'neon', 'drink', 'palmas', 'arcos', 'ondas', 'ponte', 'penha', 'skyline',
] as const;
export const COVER_PALETTE_IDS = [
  'rosa-ambar', 'turquesa-coral', 'tangerina-petroleo', 'lima-ameixa', 'ceu-poente', 'menta-amora',
  'anil-ouro', 'coral-marinho', 'esmeralda-pessego', 'violeta-ciano', 'sol-vinho', 'rosa-oceano',
] as const;
/** a = as drawn, b = mirrored, c = zoomed in, d = mirrored and zoomed out. */
export const COVER_VARIANT_IDS = ['a', 'b', 'c', 'd'] as const;

export type CoverTemplateId = (typeof COVER_TEMPLATE_IDS)[number];

/** Template family per genre slug (docs/VENUES.md taxonomy). */
export const GENRE_TEMPLATES: Record<string, readonly CoverTemplateId[]> = {
  funk: ['raio', 'galera', 'equalizador', 'neon', 'disco'],
  'pagode-samba': ['sol-mare', 'arcos', 'palmas', 'ondas', 'galera'],
  sertanejo: ['guitarra', 'penha', 'sol-mare', 'palmas', 'ponte'],
  'eletronica-house': ['disco', 'equalizador', 'neon', 'raio', 'vinil'],
  'pop-hits': ['disco', 'neon', 'drink', 'lua', 'skyline'],
  'rock-indie': ['guitarra', 'vinil', 'raio', 'lua', 'skyline'],
  'metal-punk-goth': ['raio', 'lua', 'guitarra', 'penha', 'vinil'],
  'forro-tecnobrega': ['palmas', 'sol-mare', 'arcos', 'ponte', 'ondas'],
  'hip-hop-rnb': ['vinil', 'skyline', 'neon', 'lua', 'drink'],
  'karaoke-ao-vivo': ['guitarra', 'galera', 'neon', 'vinil', 'drink'],
};

/** Used when an event has no known genre. */
const ANY_TEMPLATE: readonly CoverTemplateId[] = COVER_TEMPLATE_IDS;

/** FNV-1a (32 bit) with a final avalanche, stable across engines (Hermes safe, no BigInt). */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export interface CoverInput {
  genreSlugs: readonly string[];
  venueSlug?: string;
  eventId: string;
}

export function coverFor({ genreSlugs, venueSlug, eventId }: CoverInput): CoverKey {
  const known = genreSlugs.filter((g) => GENRE_TEMPLATES[g]);
  const genre = known.length ? known[hashString(`${eventId}|genre`) % known.length] : undefined;
  const family = genre ? GENRE_TEMPLATES[genre] : ANY_TEMPLATE;
  const template = family[hashString(`${eventId}|template`) % family.length];
  const palette = COVER_PALETTE_IDS[hashString(`${eventId}|palette`) % COVER_PALETTE_IDS.length];
  const variant = COVER_VARIANT_IDS[hashString(`${venueSlug ?? ''}|${eventId}|variant`) % COVER_VARIANT_IDS.length];
  return `art:${template}:${palette}:${variant}`;
}

export interface ParsedCoverKey {
  template: string;
  palette: string;
  variant: string;
}

/** Parses `art:<template>:<palette>:<variant>`; returns null for legacy or malformed keys. */
export function parseCoverKey(key: string): ParsedCoverKey | null {
  const m = /^art:([a-z0-9-]+):([a-z0-9-]+):([a-z0-9-]+)$/.exec(key);
  return m ? { template: m[1], palette: m[2], variant: m[3] } : null;
}

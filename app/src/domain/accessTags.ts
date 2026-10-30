// Vibe & access tags. Slugs are stored in Postgres (CHECK in migration 0009) and in the feed; labels live here.

export const ACCESS_TAGS = [
  { slug: 'acessivel', label: 'Acessível' },
  { slug: 'lgbtqia', label: 'LGBTQIA+ friendly' },
  { slug: 'pet-friendly', label: 'Pet friendly' },
  { slug: 'vegano', label: 'Opção vegana' },
] as const;

export type AccessTag = (typeof ACCESS_TAGS)[number]['slug'];

const ORDER = new Map<string, number>(ACCESS_TAGS.map((t, i) => [t.slug, i]));

export const isAccessTag = (v: unknown): v is AccessTag => typeof v === 'string' && ORDER.has(v);

export function tagLabel(slug: AccessTag): string {
  return ACCESS_TAGS.find((t) => t.slug === slug)!.label;
}

/** Known slugs only, de-duplicated, in catalog order. Anything that is not an array of strings becomes []. */
export function cleanTags(v: unknown): AccessTag[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter(isAccessTag))].sort((a, b) => ORDER.get(a)! - ORDER.get(b)!);
}

type Tagged = { accessTags?: readonly string[] };

/** An event's tags are its venue's plus its own. */
export function effectiveTags(venue: Tagged, event: Tagged): AccessTag[] {
  return cleanTags([...(venue.accessTags ?? []), ...(event.accessTags ?? [])]);
}

/** AND match: `have` must contain every tag in `wanted`. */
export function matchesTags(have: readonly string[], wanted: readonly string[] | undefined): boolean {
  if (!wanted || wanted.length === 0) return true;
  return wanted.every((t) => have.includes(t));
}

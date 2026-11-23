// Canonical venue schema validation, normalization, and deduplication.
// Pure TypeScript (no RN or Node-only imports) so seed, ingest, API, and app share one contract.

import { cleanTags } from './accessTags';
import { isValidCoverImageUrl, venueCoverFor } from './cover';
import { haversineKm } from './geo';
import { DEFAULT_UF, isUf } from './region';
import type { PriceRange, Venue, VenueStatus } from './types';

export const PRICE_RANGES: readonly PriceRange[] = ['$', '$$', '$$$', '$$$$'] as const;
export const VENUE_STATUSES: readonly VenueStatus[] = ['open', 'closed', 'unverified'] as const;

export const CANONICAL_GENRE_SLUGS: readonly string[] = [
  'funk',
  'pagode-samba',
  'sertanejo',
  'eletronica-house',
  'pop-hits',
  'rock-indie',
  'metal-punk-goth',
  'forro-tecnobrega',
  'hip-hop-rnb',
  'karaoke-ao-vivo',
] as const;

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const COVER_KEY_RE = /^[a-z0-9:_-]{1,48}$/;
const ISO_UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export interface DedupeDrop {
  keptSlug: string;
  droppedSlug: string;
  reason: 'id' | 'slug' | 'name-area' | 'name-proximity';
}

export interface DedupeResult {
  unique: Venue[];
  duplicates: DedupeDrop[];
}

/** Lowercase, strip accents and non-alphanumeric chars for deduplication comparisons. */
export function foldVenueText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function isPriceRange(v: unknown): v is PriceRange {
  return typeof v === 'string' && (PRICE_RANGES as readonly string[]).includes(v);
}

/**
 * Validates and normalizes a raw venue record against the canonical schema.
 * Rejects incomplete, out-of-range, or malformed records with actionable errors.
 */
export function validateVenue(
  raw: unknown,
  allowedGenres: ReadonlySet<string> = new Set(CANONICAL_GENRE_SLUGS),
): ValidationResult<Venue> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['venue must be a non-null object'] };
  }
  const r = raw as Record<string, unknown>;
  const errors: string[] = [];

  const str = (field: string, minLen = 1, maxLen = 160): string => {
    const val = r[field];
    if (typeof val !== 'string') {
      errors.push(`${field} must be a string`);
      return '';
    }
    const trimmed = val.trim();
    if (trimmed.length < minLen || trimmed.length > maxLen) {
      errors.push(`${field} length must be between ${minLen} and ${maxLen}`);
    }
    return trimmed;
  };

  const id = str('id', 1, 80);
  const slug = str('slug', 1, 100);
  if (slug && !SLUG_RE.test(slug)) errors.push(`slug "${slug}" must be lowercase kebab-case`);

  const name = str('name', 2, 120);
  const area = str('area', 2, 80);
  const city = str('city', 2, 80);

  const ufRaw = r.uf === undefined || r.uf === null ? DEFAULT_UF : r.uf;
  if (!isUf(ufRaw)) errors.push(`uf "${String(ufRaw)}" is not a valid Brazilian UF`);

  const lat = typeof r.lat === 'number' ? r.lat : Number.NaN;
  const lng = typeof r.lng === 'number' ? r.lng : Number.NaN;
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) errors.push('lat must be a finite number between -90 and 90');
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) errors.push('lng must be a finite number between -180 and 180');
  if (lat === 0 && lng === 0) errors.push('lat/lng cannot be (0, 0) null island');

  const status = r.status;
  if (typeof status !== 'string' || !(VENUE_STATUSES as readonly string[]).includes(status)) {
    errors.push(`status must be one of ${VENUE_STATUSES.join(', ')}`);
  }

  if (typeof r.adultOnly !== 'boolean') errors.push('adultOnly must be a boolean');
  if (typeof r.placeholder !== 'boolean') errors.push('placeholder must be a boolean');

  if (!Array.isArray(r.genreSlugs) || r.genreSlugs.length === 0) {
    errors.push('genreSlugs must be a non-empty array of canonical genre slugs');
  } else {
    for (const g of r.genreSlugs) {
      if (typeof g !== 'string' || !allowedGenres.has(g)) {
        errors.push(`unknown genre slug "${String(g)}"`);
      }
    }
  }

  const priceRange = r.priceRange;
  if (!isPriceRange(priceRange)) {
    errors.push(`priceRange must be one of ${PRICE_RANGES.join(', ')}`);
  }

  const hours = str('hours', 3, 140);

  const address =
    r.address === undefined || r.address === null
      ? undefined
      : typeof r.address === 'string' && r.address.trim().length > 0
        ? r.address.trim()
        : (errors.push('address must be a non-empty string when provided'), undefined);

  const updatedAt = r.updatedAt;
  if (typeof updatedAt !== 'string' || !ISO_UTC_RE.test(updatedAt) || !Number.isFinite(Date.parse(updatedAt))) {
    errors.push('updatedAt must be a valid ISO 8601 timestamp');
  }

  let imageUrl: string | undefined;
  if (r.imageUrl !== undefined && r.imageUrl !== null && r.imageUrl !== '') {
    if (!isValidCoverImageUrl(r.imageUrl)) {
      errors.push('imageUrl must be a valid https URL or /covers/* path');
    } else {
      imageUrl = r.imageUrl.trim();
    }
  }

  const genreSlugs = Array.isArray(r.genreSlugs)
    ? [...new Set(r.genreSlugs.filter((g): g is string => typeof g === 'string' && allowedGenres.has(g)))]
    : [];

  let coverKey: string;
  if (typeof r.coverKey === 'string' && COVER_KEY_RE.test(r.coverKey.trim())) {
    coverKey = r.coverKey.trim();
  } else if (r.coverKey === undefined || r.coverKey === null || r.coverKey === '') {
    coverKey = venueCoverFor({ genreSlugs, venueSlug: slug || 'generic' });
  } else {
    errors.push('coverKey must match ^[a-z0-9:_-]{1,48}$');
    coverKey = 'generic';
  }

  if (errors.length > 0) return { ok: false, errors };

  const value: Venue = {
    id,
    slug,
    name,
    area,
    city,
    uf: isUf(ufRaw) ? ufRaw : DEFAULT_UF,
    ...(address ? { address } : {}),
    lat: Math.round(lat * 1_000_000) / 1_000_000,
    lng: Math.round(lng * 1_000_000) / 1_000_000,
    status: status as VenueStatus,
    adultOnly: r.adultOnly as boolean,
    genreSlugs,
    accessTags: cleanTags(r.accessTags),
    priceRange: priceRange as PriceRange,
    hours,
    coverKey,
    ...(imageUrl ? { imageUrl } : {}),
    placeholder: r.placeholder as boolean,
    updatedAt: new Date(updatedAt as string).toISOString(),
  };

  return { ok: true, value };
}

/**
 * Deterministically deduplicates venues by id, slug, folded (name, area, city), or folded (name, city) within 150m.
 * When a duplicate is found, the first/canonical entry wins (or callers can pre-sort by priority/updatedAt).
 */
export function dedupeVenues(venues: readonly Venue[], proximityKm = 0.15): DedupeResult {
  const unique: Venue[] = [];
  const duplicates: DedupeDrop[] = [];
  const byId = new Map<string, Venue>();
  const bySlug = new Map<string, Venue>();
  const byNameArea = new Map<string, Venue>();
  const byNameCity = new Map<string, Venue[]>();

  for (const v of venues) {
    const dupId = byId.get(v.id);
    if (dupId) {
      duplicates.push({ keptSlug: dupId.slug, droppedSlug: v.slug, reason: 'id' });
      continue;
    }
    const dupSlug = bySlug.get(v.slug);
    if (dupSlug) {
      duplicates.push({ keptSlug: dupSlug.slug, droppedSlug: v.slug, reason: 'slug' });
      continue;
    }
    const nameKey = foldVenueText(v.name);
    const cityKey = foldVenueText(v.city);
    const areaKey = foldVenueText(v.area);
    const nameAreaKey = `${nameKey}|${areaKey}|${cityKey}`;
    const dupNameArea = byNameArea.get(nameAreaKey);
    if (dupNameArea) {
      duplicates.push({ keptSlug: dupNameArea.slug, droppedSlug: v.slug, reason: 'name-area' });
      continue;
    }
    const nameCityKey = `${nameKey}|${cityKey}`;
    const sameCity = byNameCity.get(nameCityKey) ?? [];
    const nearDup = sameCity.find((existing) => haversineKm(existing.lat, existing.lng, v.lat, v.lng) <= proximityKm);
    if (nearDup) {
      duplicates.push({ keptSlug: nearDup.slug, droppedSlug: v.slug, reason: 'name-proximity' });
      continue;
    }

    byId.set(v.id, v);
    bySlug.set(v.slug, v);
    byNameArea.set(nameAreaKey, v);
    sameCity.push(v);
    byNameCity.set(nameCityKey, sameCity);
    unique.push(v);
  }

  return { unique, duplicates };
}

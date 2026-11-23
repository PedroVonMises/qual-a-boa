import { isValidCoverImageUrl, localFallbackCoverPath, venueCoverFor } from './cover';
import type { Venue } from './types';
import { dedupeVenues, foldVenueText, validateVenue } from './venueSchema';

const validRaw = {
  id: '11111111-1111-3111-8111-111111111111',
  slug: 'club-maresia',
  name: 'Club Maresia',
  area: 'Praia do Canto',
  city: 'Vitória',
  uf: 'ES',
  address: 'R. Joaquim Lírio, 500 - Praia do Canto',
  lat: -20.2965,
  lng: -40.2945,
  status: 'open',
  adultOnly: true,
  genreSlugs: ['eletronica-house', 'pop-hits'],
  accessTags: ['lgbtqia', 'acessivel'],
  priceRange: '$$$',
  hours: 'Sex e sáb, 23h–06h',
  coverKey: 'art:disco:rosa-ambar:a',
  placeholder: true,
  updatedAt: '2026-11-23T03:00:00.000Z',
};

describe('validateVenue (canonical schema)', () => {
  it('accepts and normalizes a valid canonical venue', () => {
    const res = validateVenue(validRaw);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.slug).toBe('club-maresia');
      expect(res.value.uf).toBe('ES');
      expect(res.value.priceRange).toBe('$$$');
      expect(res.value.updatedAt).toBe('2026-11-23T03:00:00.000Z');
    }
  });

  it('auto-generates deterministic coverKey when omitted', () => {
    const { coverKey: _omit, ...withoutCover } = validRaw;
    const res = validateVenue(withoutCover);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.coverKey).toBe(venueCoverFor({ genreSlugs: validRaw.genreSlugs, venueSlug: validRaw.slug }));
    }
  });

  it('rejects non-objects and missing required fields', () => {
    expect(validateVenue(null).ok).toBe(false);
    expect(validateVenue([]).ok).toBe(false);
    expect(validateVenue({}).ok).toBe(false);
    expect(validateVenue({ ...validRaw, name: '' }).ok).toBe(false);
    expect(validateVenue({ ...validRaw, city: '' }).ok).toBe(false);
    expect(validateVenue({ ...validRaw, area: '' }).ok).toBe(false);
    expect(validateVenue({ ...validRaw, hours: '' }).ok).toBe(false);
  });

  it('rejects bad slugs, coordinates, genres, priceRange, status, updatedAt, and unsafe imageUrl', () => {
    expect(validateVenue({ ...validRaw, slug: 'Club Maresia!' }).ok).toBe(false);
    expect(validateVenue({ ...validRaw, lat: 95 }).ok).toBe(false);
    expect(validateVenue({ ...validRaw, lng: -200 }).ok).toBe(false);
    expect(validateVenue({ ...validRaw, lat: 0, lng: 0 }).ok).toBe(false);
    expect(validateVenue({ ...validRaw, genreSlugs: [] }).ok).toBe(false);
    expect(validateVenue({ ...validRaw, genreSlugs: ['unknown-style'] }).ok).toBe(false);
    expect(validateVenue({ ...validRaw, priceRange: '$$$$$' }).ok).toBe(false);
    expect(validateVenue({ ...validRaw, status: 'maybe' }).ok).toBe(false);
    expect(validateVenue({ ...validRaw, updatedAt: 'not-a-date' }).ok).toBe(false);
    expect(validateVenue({ ...validRaw, imageUrl: 'http://insecure.example/a.jpg' }).ok).toBe(false);
    expect(validateVenue({ ...validRaw, imageUrl: 'javascript:alert(1)' }).ok).toBe(false);
    expect(validateVenue({ ...validRaw, imageUrl: 'https://user@evil.example/a.jpg' }).ok).toBe(false);
  });

  it('accepts valid https and local /covers/* image URLs', () => {
    expect(validateVenue({ ...validRaw, imageUrl: 'https://cdn.example.com/club.webp' }).ok).toBe(true);
    expect(validateVenue({ ...validRaw, imageUrl: '/covers/funk.svg' }).ok).toBe(true);
  });
});

describe('dedupeVenues', () => {
  const mk = (over: Partial<Venue>): Venue => ({
    ...(validateVenue(validRaw) as { ok: true; value: Venue }).value,
    ...over,
  });

  it('drops duplicates by id, slug, folded name+area+city, and name+city within 150m', () => {
    const v1 = mk({ id: '1', slug: 'club-maresia', name: 'Club Maresia', area: 'Praia do Canto', lat: -20.2965, lng: -40.2945 });
    const dupId = mk({ id: '1', slug: 'other-slug', name: 'Outro Nome', lat: -20.31, lng: -40.31 });
    const dupSlug = mk({ id: '2', slug: 'club-maresia', name: 'Outro Nome 2', lat: -20.32, lng: -40.32 });
    const dupNameArea = mk({ id: '3', slug: 'club-maresia-2', name: 'CLUB MARÉSIA!', area: 'praia do canto', lat: -20.33, lng: -40.33 });
    const dupProx = mk({ id: '4', slug: 'club-maresia-near', name: 'Club Maresia', area: 'Santa Lúcia', lat: -20.2968, lng: -40.2946 });
    const distinct = mk({ id: '5', slug: 'club-maresia-serra', name: 'Club Maresia', area: 'Laranjeiras', city: 'Serra', lat: -20.1975, lng: -40.2525 });

    const { unique, duplicates } = dedupeVenues([v1, dupId, dupSlug, dupNameArea, dupProx, distinct]);
    expect(unique.map((v) => v.id)).toEqual(['1', '5']);
    expect(duplicates.map((d) => d.reason)).toEqual(['id', 'slug', 'name-area', 'name-proximity']);
  });

  it('folds accents and punctuation consistently', () => {
    expect(foldVenueText('Café & Bar Maré-Alta!')).toBe('cafe bar mare alta');
  });
});

describe('media fallback helpers', () => {
  it('validates image URLs strictly and computes deterministic local SVG fallbacks', () => {
    expect(isValidCoverImageUrl('https://images.example.com/poster.jpg')).toBe(true);
    expect(isValidCoverImageUrl('/covers/eletronica-house.svg')).toBe(true);
    expect(isValidCoverImageUrl('http://images.example.com/poster.jpg')).toBe(false);
    expect(isValidCoverImageUrl('data:image/png;base64,abc')).toBe(false);
    expect(isValidCoverImageUrl('not-a-url')).toBe(false);
    expect(localFallbackCoverPath(['funk', 'pop-hits'])).toBe('/covers/funk.svg');
    expect(localFallbackCoverPath(['unknown'])).toBe('/covers/generic.svg');
    expect(localFallbackCoverPath([])).toBe('/covers/generic.svg');
  });
});

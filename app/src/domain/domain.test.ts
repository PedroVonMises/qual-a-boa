import { MINI_NOW } from '@/data/__fixtures__/mini';
import {
  countActiveFilters,
  dateRangeBounds,
  defaultFilters,
  IN_PROGRESS_WINDOW_MS,
  filtersToUrlParams,
  toSearchParams,
  urlParamsToFilters,
} from './filters';
import { formatBRL, formatCountdown, formatDistance, formatEventDate, formatPriceLabel, formatRelative } from './format';
import { haversineKm } from './geo';

const NOW = Date.parse(MINI_NOW); // Friday 12:00 SP

describe('format', () => {
  it('formatBRL', () => {
    expect(formatBRL(1234.5)).toBe('R$ 1.234,50');
    expect(formatBRL(0)).toBe('R$ 0,00');
  });
  it('formatPriceLabel', () => {
    expect(formatPriceLabel(null, null, true)).toBe('Grátis');
    expect(formatPriceLabel(null, null, false)).toBe('Preço a confirmar');
    expect(formatPriceLabel(30, 30, false)).toBe('R$ 30');
    expect(formatPriceLabel(30, 60, false)).toBe('R$ 30 a R$ 60');
  });
  it('formatDistance', () => {
    expect(formatDistance(0.45)).toBe('450 m');
    expect(formatDistance(2.34)).toBe('2,3 km');
  });
  it('formatEventDate uses São Paulo time', () => {
    expect(formatEventDate('2026-10-23T23:00:00.000Z', NOW)).toBe('Hoje · 20h');
    expect(formatEventDate('2026-10-24T02:30:00.000Z', NOW)).toBe('Hoje · 23h30');
    expect(formatEventDate('2026-10-24T20:00:00.000Z', NOW)).toBe('Amanhã · 17h');
    expect(formatEventDate('2026-10-30T20:00:00.000Z', NOW)).toBe('Sex, 30 out · 17h');
  });
  it('formatRelative and formatCountdown', () => {
    expect(formatRelative('2026-10-23T18:00:00.000Z', NOW)).toBe('em 3 h');
    expect(formatRelative('2026-10-21T15:00:00.000Z', NOW)).toBe('há 2 dias');
    expect(formatCountdown('2026-10-24T18:30:00.000Z', NOW)).toBe('1 d 3 h');
    expect(formatCountdown('2026-10-23T14:00:00.000Z', NOW)).toBe('Agora');
  });
});

describe('geo', () => {
  it('haversine is zero for the same point and symmetric', () => {
    expect(haversineKm(-20.3, -40.3, -20.3, -40.3)).toBe(0);
    const a = haversineKm(-20.3, -40.3, -20.34, -40.29);
    expect(a).toBeCloseTo(haversineKm(-20.34, -40.29, -20.3, -40.3), 6);
    expect(a).toBeGreaterThan(4);
    expect(a).toBeLessThan(5);
  });
});

describe('filters', () => {
  it('hoje lasts until 06:00 SP and keeps in-progress events', () => {
    const b = dateRangeBounds('hoje', NOW);
    expect(b.dateTo).toBe('2026-10-24T08:59:59.999Z');
    expect(Date.parse(b.dateFrom!)).toBe(NOW - IN_PROGRESS_WINDOW_MS);
  });
  it('hoje after midnight still covers last night until 06:00', () => {
    const lateNight = Date.parse('2026-10-24T03:30:00.000Z'); // 00:30 SP Saturday
    expect(dateRangeBounds('hoje', lateNight).dateTo).toBe('2026-10-24T08:59:59.999Z');
  });
  it('fim-de-semana from Friday 18h to Sunday end', () => {
    const b = dateRangeBounds('fim-de-semana', NOW);
    expect(b.dateFrom).toBe('2026-10-23T21:00:00.000Z');
    expect(b.dateTo).toBe('2026-10-26T08:59:59.999Z');
  });
  it('fim-de-semana on Saturday starts 5h back, keeping in-progress events', () => {
    const sat = Date.parse('2026-10-24T15:00:00.000Z');
    expect(dateRangeBounds('fim-de-semana', sat).dateFrom).toBe(new Date(sat - IN_PROGRESS_WINDOW_MS).toISOString());
  });
  it('qualquer only reaches back to in-progress events', () => {
    expect(dateRangeBounds('qualquer', NOW)).toEqual({ dateFrom: new Date(NOW - IN_PROGRESS_WINDOW_MS).toISOString() });
  });
  it('toSearchParams omits empty filters', () => {
    const p = toSearchParams(defaultFilters, { lat: 1, lng: 2 }, NOW);
    expect(p).toEqual({
      lat: 1,
      lng: 2,
      radiusKm: 10,
      sort: 'popularity', // `recommended` is client-only: repos get a candidate query
      limit: 80,
      now: MINI_NOW,
      dateFrom: new Date(NOW - IN_PROGRESS_WINDOW_MS).toISOString(),
    });
    const q = toSearchParams({ ...defaultFilters, genreSlugs: ['funk'], priceMax: 0, query: ' x ' }, { lat: 1, lng: 2 }, NOW);
    expect(q).toMatchObject({ genreSlugs: ['funk'], priceMax: 0, query: 'x' });
  });
  it('countActiveFilters', () => {
    expect(countActiveFilters(defaultFilters)).toBe(0);
    expect(countActiveFilters({ ...defaultFilters, priceMax: 0, radiusKm: 3, genreSlugs: ['rock'] })).toBe(3);
  });
  it('URL codec round-trips and ignores invalid values', () => {
    const f = { ...defaultFilters, genreSlugs: ['funk', 'rock'], priceMax: 50, radiusKm: 3 as const, dateRange: 'hoje' as const, area: 'Centro', query: 'oi', sort: 'price' as const };
    expect(urlParamsToFilters(filtersToUrlParams(f))).toEqual(f);
    expect(filtersToUrlParams(defaultFilters)).toEqual({});
    const bad = urlParamsToFilters({ radius: '7', sort: 'zzz', priceMax: 'abc', date: 'x' });
    expect(bad).toEqual(defaultFilters);
    expect(urlParamsToFilters({ genres: ['funk'] }).genreSlugs).toEqual(['funk']);
    // recommended is the default (omitted from the URL, not an active filter) and parses when explicit
    expect(urlParamsToFilters({ sort: 'recommended' }).sort).toBe('recommended');
    expect(filtersToUrlParams({ ...defaultFilters, sort: 'recommended' })).toEqual({});
    expect(countActiveFilters({ ...defaultFilters, sort: 'recommended' })).toBe(0);
    expect(urlParamsToFilters(filtersToUrlParams({ ...defaultFilters, sort: 'distance' })).sort).toBe('distance');
  });
});

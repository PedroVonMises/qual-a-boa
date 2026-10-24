import { spParts, toMs, type NowLike } from './format';
import type { GeoPoint, SearchParams, SortKey } from './types';

export const RADIUS_OPTIONS = [1, 3, 5, 10, 25] as const;
export type RadiusKm = (typeof RADIUS_OPTIONS)[number];
export type DateRange = 'hoje' | 'fim-de-semana' | 'qualquer';

export interface FilterState {
  genreSlugs: string[];
  priceMax: number | null;
  radiusKm: RadiusKm;
  dateRange: DateRange;
  artistId: string | null;
  area: string | null;
  query: string;
  sort: SortKey;
}

export const defaultFilters: FilterState = {
  genreSlugs: [],
  priceMax: null,
  radiusKm: 10,
  dateRange: 'qualquer',
  artistId: null,
  area: null,
  query: '',
  sort: 'distance',
};

const SP_OFFSET_MS = 3 * 3600_000;
const DAY = 86_400_000;

/** UTC ms of São Paulo midnight for the given SP day number. */
function spMidnight(dayNumber: number): number {
  return dayNumber * DAY + SP_OFFSET_MS;
}

/** Nights run past midnight: an event that started up to this long ago is still "on" and stays in search. */
export const IN_PROGRESS_WINDOW_MS = 5 * 3600_000;
/** "Hoje" lasts until 06:00 SP, so a 01:00 party on Friday night counts as tonight. */
const NIGHT_END_HOUR = 6;

export function dateRangeBounds(range: DateRange, nowMs: number): { dateFrom?: string; dateTo?: string } {
  const from = nowMs - IN_PROGRESS_WINDOW_MS;
  if (range === 'qualquer') return { dateFrom: new Date(from).toISOString() };
  const p = spParts(nowMs);
  if (range === 'hoje') {
    const endDay = p.hour < NIGHT_END_HOUR ? p.dayNumber : p.dayNumber + 1;
    return { dateFrom: new Date(from).toISOString(), dateTo: new Date(spMidnight(endDay) + NIGHT_END_HOUR * 3600_000 - 1).toISOString() };
  }
  // fim-de-semana: Friday 18h through Sunday 23:59:59.999 (SP). On Sat/Sun, starts now.
  const daysToFriday = p.weekday === 0 ? -2 : p.weekday === 6 ? -1 : 5 - p.weekday;
  const fridayDay = p.dayNumber + daysToFriday;
  const start = Math.max(from, spMidnight(fridayDay) + 18 * 3600_000);
  const end = spMidnight(fridayDay + 3) + NIGHT_END_HOUR * 3600_000 - 1;
  return { dateFrom: new Date(start).toISOString(), dateTo: new Date(end).toISOString() };
}

export function toSearchParams(
  filters: FilterState,
  location: Pick<GeoPoint, 'lat' | 'lng'>,
  now: NowLike = Date.now(),
): SearchParams {
  const nowMs = toMs(now);
  const params: SearchParams = {
    lat: location.lat,
    lng: location.lng,
    radiusKm: filters.radiusKm,
    sort: filters.sort,
    now: new Date(nowMs).toISOString(),
    ...dateRangeBounds(filters.dateRange, nowMs),
  };
  if (filters.genreSlugs.length) params.genreSlugs = filters.genreSlugs;
  if (filters.priceMax != null) params.priceMax = filters.priceMax;
  if (filters.artistId) params.artistId = filters.artistId;
  if (filters.area) params.area = filters.area;
  if (filters.query.trim()) params.query = filters.query.trim();
  return params;
}

export function countActiveFilters(f: FilterState): number {
  let n = 0;
  if (f.genreSlugs.length) n++;
  if (f.priceMax != null) n++;
  if (f.radiusKm !== defaultFilters.radiusKm) n++;
  if (f.dateRange !== defaultFilters.dateRange) n++;
  if (f.artistId) n++;
  if (f.area) n++;
  if (f.query.trim()) n++;
  if (f.sort !== defaultFilters.sort) n++;
  return n;
}

export type UrlParams = Record<string, string>;
export type RawUrlParams = Record<string, string | string[] | undefined>;

export function filtersToUrlParams(f: FilterState): UrlParams {
  const out: UrlParams = {};
  if (f.genreSlugs.length) out.genres = f.genreSlugs.join(',');
  if (f.priceMax != null) out.priceMax = String(f.priceMax);
  if (f.radiusKm !== defaultFilters.radiusKm) out.radius = String(f.radiusKm);
  if (f.dateRange !== defaultFilters.dateRange) out.date = f.dateRange;
  if (f.artistId) out.artist = f.artistId;
  if (f.area) out.area = f.area;
  if (f.query.trim()) out.q = f.query.trim();
  if (f.sort !== defaultFilters.sort) out.sort = f.sort;
  return out;
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function urlParamsToFilters(raw: RawUrlParams): FilterState {
  const f: FilterState = { ...defaultFilters, genreSlugs: [] };
  const genres = first(raw.genres);
  if (genres) f.genreSlugs = genres.split(',').map((s) => s.trim()).filter(Boolean);
  const price = first(raw.priceMax);
  if (price != null && price !== '' && Number.isFinite(Number(price)) && Number(price) >= 0) f.priceMax = Number(price);
  const radius = Number(first(raw.radius));
  if ((RADIUS_OPTIONS as readonly number[]).includes(radius)) f.radiusKm = radius as RadiusKm;
  const date = first(raw.date);
  if (date === 'hoje' || date === 'fim-de-semana' || date === 'qualquer') f.dateRange = date;
  f.artistId = first(raw.artist) || null;
  f.area = first(raw.area) || null;
  f.query = first(raw.q) ?? '';
  const sort = first(raw.sort);
  if (sort === 'distance' || sort === 'price' || sort === 'date' || sort === 'popularity') f.sort = sort;
  return f;
}

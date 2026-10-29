import { spParts, toMs, type NowLike } from './format';
import type { GeoPoint, SearchParams, SortKey } from './types';

export const RADIUS_OPTIONS = [1, 3, 5, 10, 25] as const;
export type RadiusKm = (typeof RADIUS_OPTIONS)[number];
export type DateRange = 'hoje' | 'amanha' | 'fim-de-semana' | 'proxima-semana' | 'datas' | 'qualquer';
const DATE_RANGES: readonly DateRange[] = ['hoje', 'amanha', 'fim-de-semana', 'proxima-semana', 'datas', 'qualquer'];

/** Nights picked on the calendar (Quando). Days are São Paulo dates, `YYYY-MM-DD`, `from <= to`. */
export interface DayRange {
  from: string;
  to: string;
}

export interface FilterState {
  genreSlugs: string[];
  priceMax: number | null;
  radiusKm: RadiusKm;
  dateRange: DateRange;
  /** Only read when `dateRange === 'datas'`. */
  days: DayRange | null;
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
  days: null,
  artistId: null,
  area: null,
  query: '',
  sort: 'recommended',
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

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** SP day number of a `YYYY-MM-DD` date, or null when malformed. Same numbering as `spParts().dayNumber`. */
export function dayNumberOf(day: string): number | null {
  const m = DAY_RE.exec(day);
  if (!m) return null;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(ms);
  if (d.getUTCFullYear() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) return null;
  return ms / DAY;
}

/** `YYYY-MM-DD` of an SP day number. */
export function dayString(dayNumber: number): string {
  return new Date(dayNumber * DAY).toISOString().slice(0, 10);
}

/** The night "tonight" belongs to: before 06:00 it is still yesterday's night. */
export function nightDayNumber(nowMs: number): number {
  const p = spParts(nowMs);
  return p.hour < NIGHT_END_HOUR ? p.dayNumber - 1 : p.dayNumber;
}

/** A valid, ordered DayRange, or null. */
export function normalizeDays(days: DayRange | null | undefined): DayRange | null {
  if (!days) return null;
  const a = dayNumberOf(days.from);
  const b = dayNumberOf(days.to);
  if (a == null || b == null) return null;
  return a <= b ? { from: days.from, to: days.to } : { from: days.to, to: days.from };
}

/** Night window of SP days [first, last]: from 06:00 of the first day to 05:59:59.999 after the last. */
function nightsBounds(first: number, last: number, nowMs: number) {
  const from = Math.max(nowMs - IN_PROGRESS_WINDOW_MS, spMidnight(first) + NIGHT_END_HOUR * 3600_000);
  const to = spMidnight(last + 1) + NIGHT_END_HOUR * 3600_000 - 1;
  return { dateFrom: new Date(from).toISOString(), dateTo: new Date(Math.max(from, to)).toISOString() };
}

export function dateRangeBounds(range: DateRange, nowMs: number, days?: DayRange | null): { dateFrom?: string; dateTo?: string } {
  const from = nowMs - IN_PROGRESS_WINDOW_MS;
  const p = spParts(nowMs);
  const tonight = nightDayNumber(nowMs);
  if (range === 'hoje') {
    const endDay = p.hour < NIGHT_END_HOUR ? p.dayNumber : p.dayNumber + 1;
    return { dateFrom: new Date(from).toISOString(), dateTo: new Date(spMidnight(endDay) + NIGHT_END_HOUR * 3600_000 - 1).toISOString() };
  }
  if (range === 'amanha') return nightsBounds(tonight + 1, tonight + 1, nowMs);
  if (range === 'proxima-semana') {
    // Monday to Sunday of next week (nights), based on the current night's weekday.
    const weekday = (p.weekday + 7 - (p.hour < NIGHT_END_HOUR ? 1 : 0)) % 7;
    const nextMonday = tonight + ((8 - weekday) % 7 || 7);
    return nightsBounds(nextMonday, nextMonday + 6, nowMs);
  }
  if (range === 'datas') {
    const d = normalizeDays(days);
    if (d) return nightsBounds(dayNumberOf(d.from)!, dayNumberOf(d.to)!, nowMs);
    return { dateFrom: new Date(from).toISOString() };
  }
  if (range === 'qualquer') return { dateFrom: new Date(from).toISOString() };
  // fim-de-semana: Friday 18h through Sunday 23:59:59.999 (SP). On Sat/Sun, starts now.
  const daysToFriday = p.weekday === 0 ? -2 : p.weekday === 6 ? -1 : 5 - p.weekday;
  const fridayDay = p.dayNumber + daysToFriday;
  const start = Math.max(from, spMidnight(fridayDay) + 18 * 3600_000);
  const end = spMidnight(fridayDay + 3) + NIGHT_END_HOUR * 3600_000 - 1;
  return { dateFrom: new Date(start).toISOString(), dateTo: new Date(end).toISOString() };
}

/** Candidate pool size fetched for the client-side `recommended` ranking. */
export const RECOMMENDED_CANDIDATES = 80;

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
    sort: filters.sort === 'recommended' ? 'popularity' : filters.sort,
    now: new Date(nowMs).toISOString(),
    ...dateRangeBounds(filters.dateRange, nowMs, filters.days),
  };
  if (filters.sort === 'recommended') params.limit = RECOMMENDED_CANDIDATES;
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
  const days = f.dateRange === 'datas' ? normalizeDays(f.days) : null;
  if (days) {
    out.de = days.from;
    out.ate = days.to;
  }
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
  if (date && (DATE_RANGES as readonly string[]).includes(date)) f.dateRange = date as DateRange;
  if (f.dateRange === 'datas') {
    const de = first(raw.de);
    const days = de ? normalizeDays({ from: de, to: first(raw.ate) || de }) : null;
    if (days) f.days = days;
    else f.dateRange = defaultFilters.dateRange;
  }
  f.artistId = first(raw.artist) || null;
  f.area = first(raw.area) || null;
  f.query = first(raw.q) ?? '';
  const sort = first(raw.sort);
  if (sort === 'distance' || sort === 'price' || sort === 'date' || sort === 'popularity' || sort === 'recommended') f.sort = sort;
  return f;
}

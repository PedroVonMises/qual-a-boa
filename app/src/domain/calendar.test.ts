jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import { MINI_NOW } from '@/data/__fixtures__/mini';
import { pushRecent, searchKey } from '@/state/searchHistory';
import { venueHits } from '@/features/busca/logic';
import { addMonths, dateFilterLabel, monthGrid, monthOf, pickDay, rangeLabel } from './calendar';
import {
  countActiveFilters,
  dateRangeBounds,
  dayNumberOf,
  dayString,
  defaultFilters,
  filtersToUrlParams,
  nightDayNumber,
  normalizeDays,
  toSearchParams,
  urlParamsToFilters,
} from './filters';
import type { SearchItem, Venue } from './types';

const NOW = Date.parse(MINI_NOW); // Friday 2026-10-23 12:00 SP

describe('date ranges (Quando)', () => {
  it('amanhã is the next night, 06:00 to 05:59', () => {
    expect(dateRangeBounds('amanha', NOW)).toEqual({ dateFrom: '2026-10-24T09:00:00.000Z', dateTo: '2026-10-25T08:59:59.999Z' });
  });
  it('amanhã after midnight still means the night after the current one', () => {
    const lateNight = Date.parse('2026-10-24T03:30:00.000Z'); // Sat 00:30 SP, still Friday night
    expect(dateRangeBounds('amanha', lateNight).dateFrom).toBe('2026-10-24T09:00:00.000Z');
  });
  it('próxima semana runs Monday to Sunday night of next week', () => {
    expect(dateRangeBounds('proxima-semana', NOW)).toEqual({ dateFrom: '2026-10-26T09:00:00.000Z', dateTo: '2026-11-02T08:59:59.999Z' });
  });
  it('datas covers the picked nights and never reaches before in-progress events', () => {
    const b = dateRangeBounds('datas', NOW, { from: '2026-10-23', to: '2026-10-25' });
    expect(b).toEqual({ dateFrom: '2026-10-23T10:00:00.000Z', dateTo: '2026-10-26T08:59:59.999Z' });
    // Reversed input is normalized; invalid input falls back to "qualquer".
    expect(dateRangeBounds('datas', NOW, { from: '2026-10-25', to: '2026-10-23' })).toEqual(b);
    expect(dateRangeBounds('datas', NOW, { from: '2026-02-30', to: 'x' }).dateTo).toBeUndefined();
  });
  it('toSearchParams passes the picked days through', () => {
    const p = toSearchParams({ ...defaultFilters, dateRange: 'datas', days: { from: '2026-10-24', to: '2026-10-24' } }, { lat: 1, lng: 2 }, NOW);
    expect(p.dateTo).toBe('2026-10-25T08:59:59.999Z');
    expect(countActiveFilters({ ...defaultFilters, dateRange: 'datas', days: { from: '2026-10-24', to: '2026-10-24' } })).toBe(1);
  });
  it('URL codec round-trips picked days and drops broken ones', () => {
    const f = { ...defaultFilters, dateRange: 'datas' as const, days: { from: '2026-10-24', to: '2026-10-26' } };
    expect(filtersToUrlParams(f)).toEqual({ date: 'datas', de: '2026-10-24', ate: '2026-10-26' });
    expect(urlParamsToFilters(filtersToUrlParams(f))).toEqual(f);
    expect(urlParamsToFilters({ date: 'datas', de: 'nope' })).toEqual(defaultFilters);
    expect(urlParamsToFilters({ date: 'amanha' }).dateRange).toBe('amanha');
    expect(urlParamsToFilters({ date: 'datas', de: '2026-10-24' }).days).toEqual({ from: '2026-10-24', to: '2026-10-24' });
  });
  it('day helpers agree with each other', () => {
    expect(dayString(dayNumberOf('2026-10-23')!)).toBe('2026-10-23');
    expect(nightDayNumber(NOW)).toBe(dayNumberOf('2026-10-23'));
    expect(nightDayNumber(Date.parse('2026-10-24T03:30:00.000Z'))).toBe(dayNumberOf('2026-10-23'));
    expect(normalizeDays(null)).toBeNull();
  });
});

describe('calendar', () => {
  const oct = { year: 2026, month: 9 };
  it('builds a Sunday-first grid with leading blanks', () => {
    const cells = monthGrid(oct);
    expect(cells).toHaveLength(35);
    expect(cells.slice(0, 4)).toEqual([null, null, null, null]);
    expect(cells[4]).toMatchObject({ day: 1, weekday: 4 }); // Thursday
    expect(cells[34]).toMatchObject({ day: 31, weekday: 6 });
  });
  it('moves across years', () => {
    expect(addMonths(oct, 3)).toEqual({ year: 2027, month: 0 });
    expect(addMonths({ year: 2027, month: 0 }, -1)).toEqual({ year: 2026, month: 11 });
    expect(monthOf(dayNumberOf('2026-12-31')!)).toEqual({ year: 2026, month: 11 });
  });
  it('first tap picks a night, the next later tap extends, then it starts over', () => {
    const d = (s: string) => dayNumberOf(s)!;
    const one = pickDay(null, d('2026-10-23'));
    expect(one).toEqual({ from: '2026-10-23', to: '2026-10-23' });
    const range = pickDay(one, d('2026-10-25'));
    expect(range).toEqual({ from: '2026-10-23', to: '2026-10-25' });
    expect(pickDay(range, d('2026-10-28'))).toEqual({ from: '2026-10-28', to: '2026-10-28' });
    expect(pickDay(one, d('2026-10-20'))).toEqual({ from: '2026-10-20', to: '2026-10-20' });
  });
  it('labels', () => {
    expect(rangeLabel({ from: '2026-10-23', to: '2026-10-25' })).toBe('sex 23 – dom 25 out');
    expect(rangeLabel({ from: '2026-10-30', to: '2026-11-01' })).toBe('sex 30 out – dom 1 nov');
    expect(rangeLabel({ from: '2026-10-24', to: '2026-10-24' })).toBe('sáb 24 out');
    expect(dateFilterLabel('qualquer', null)).toBe('Qualquer dia');
    expect(dateFilterLabel('proxima-semana', null)).toBe('Próxima semana');
  });
});

describe('search history', () => {
  it('dedupes ignoring case and accents, newest first, capped', () => {
    let list: string[] = [];
    list = pushRecent(list, 'Pagode');
    list = pushRecent(list, 'funk');
    list = pushRecent(list, '  págode  ');
    expect(list).toEqual(['págode', 'funk']);
    expect(pushRecent(list, '   ')).toBe(list);
    expect(pushRecent(['a', 'b', 'c'], 'd', 3)).toEqual(['d', 'a', 'b']);
    expect(searchKey(' Ágata ')).toBe('agata');
  });
});

describe('busca venue hits', () => {
  const venue = (id: string, name: string, area: string) => ({ id, slug: id, name, area }) as Venue;
  const item = (v: Venue, km: number) => ({ venue: v, distanceKm: km, event: { id: `${v.id}-${km}` } }) as SearchItem;
  it('keeps venues whose name or area match, nearest first, counting events', () => {
    const selva = venue('selva', 'Selva Bar', 'Jardim da Penha');
    const bolt = venue('bolt', 'Bolt Club', 'Praia do Canto');
    const items = [item(selva, 3), item(bolt, 1), item(selva, 3)];
    expect(venueHits(items, 'selva')).toEqual([{ venue: selva, distanceKm: 3, upcoming: 2 }]);
    expect(venueHits(items, 'praia').map((h) => h.venue.id)).toEqual(['bolt']);
    expect(venueHits(items, '  ')).toEqual([]);
  });
});

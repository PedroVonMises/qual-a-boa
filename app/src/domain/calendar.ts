// Calendar math for the Quando sheet. Pure and deterministic: SP days are numbered like spParts().dayNumber.
import { dayNumberOf, dayString, normalizeDays, type DateRange, type DayRange } from './filters';

const DAY = 86_400_000;
export const WEEKDAY_INITIALS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] as const;
const WEEKDAYS_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const WEEKDAYS_LONG = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTHS_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export interface MonthRef {
  year: number;
  /** 0-11 */
  month: number;
}

export interface DayCell {
  dayNumber: number;
  day: number;
  weekday: number;
}

const fields = (dayNumber: number) => {
  const d = new Date(dayNumber * DAY);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate(), weekday: d.getUTCDay() };
};

export function monthOf(dayNumber: number): MonthRef {
  const { year, month } = fields(dayNumber);
  return { year, month };
}

export function addMonths(m: MonthRef, delta: number): MonthRef {
  const total = m.year * 12 + m.month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

export const compareMonths = (a: MonthRef, b: MonthRef) => a.year * 12 + a.month - (b.year * 12 + b.month);

export function monthTitle(m: MonthRef): string {
  const name = MONTHS_LONG[m.month];
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${m.year}`;
}

/** Weeks start on Sunday. Leading/trailing slots are null so every row has 7 cells. */
export function monthGrid(m: MonthRef): (DayCell | null)[] {
  const first = Date.UTC(m.year, m.month, 1) / DAY;
  const days = new Date(Date.UTC(m.year, m.month + 1, 0)).getUTCDate();
  const lead = fields(first).weekday;
  const cells: (DayCell | null)[] = Array.from({ length: lead }, () => null);
  for (let i = 0; i < days; i++) {
    const dn = first + i;
    cells.push({ dayNumber: dn, day: i + 1, weekday: fields(dn).weekday });
  }
  while (cells.length % 7) cells.push(null);
  return cells;
}

/** "sexta, 23 de outubro" (screen readers). */
export function longDayLabel(dayNumber: number): string {
  const f = fields(dayNumber);
  return `${WEEKDAYS_LONG[f.weekday]}, ${f.day} de ${MONTHS_LONG[f.month]}`;
}

/** "sex 23 out" */
export function shortDayLabel(dayNumber: number, withMonth = true): string {
  const f = fields(dayNumber);
  return withMonth ? `${WEEKDAYS_SHORT[f.weekday]} ${f.day} ${MONTHS_SHORT[f.month]}` : `${WEEKDAYS_SHORT[f.weekday]} ${f.day}`;
}

/** Applies a tap on day `dn` to the current selection: first tap picks one night, a later day extends it. */
export function pickDay(current: DayRange | null, dn: number): DayRange {
  const day = dayString(dn);
  const sel = normalizeDays(current);
  if (!sel) return { from: day, to: day };
  const a = dayNumberOf(sel.from)!;
  const b = dayNumberOf(sel.to)!;
  // A finished range (or a tap before the start) starts over.
  if (a !== b || dn < a) return { from: day, to: day };
  return { from: sel.from, to: day };
}

export function rangeLabel(days: DayRange | null): string {
  const d = normalizeDays(days);
  if (!d) return 'Escolher datas';
  const a = dayNumberOf(d.from)!;
  const b = dayNumberOf(d.to)!;
  if (a === b) return shortDayLabel(a);
  const sameMonth = fields(a).month === fields(b).month;
  return `${shortDayLabel(a, !sameMonth)} – ${shortDayLabel(b)}`;
}

const RANGE_LABELS: Record<Exclude<DateRange, 'datas'>, string> = {
  hoje: 'Hoje',
  amanha: 'Amanhã',
  'fim-de-semana': 'Fim de semana',
  'proxima-semana': 'Próxima semana',
  qualquer: 'Qualquer dia',
};

/** Label of the active date filter for the Explorar pill. */
export function dateFilterLabel(range: DateRange, days: DayRange | null): string {
  return range === 'datas' ? rangeLabel(days) : RANGE_LABELS[range];
}

/** Quick picks shown at the top of the sheet, in order. */
export const QUICK_RANGES: { value: Exclude<DateRange, 'datas'>; label: string }[] = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'amanha', label: 'Amanhã' },
  { value: 'fim-de-semana', label: 'Fim de semana' },
  { value: 'proxima-semana', label: 'Próxima semana' },
  { value: 'qualquer', label: 'Qualquer dia' },
];

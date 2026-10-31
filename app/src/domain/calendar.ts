// Calendar math for the Quando sheet. Pure and deterministic: SP days are numbered like spParts().dayNumber.
import { dayNumberOf, dayString, nightDayNumber, normalizeDays, type DateRange, type DayRange } from './filters';

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

const WEEKDAY_WITH_PREPOSITION = ['no domingo', 'na segunda', 'na terça', 'na quarta', 'na quinta', 'na sexta', 'no sábado'];

/** "dia 14 de novembro": the form for a day too far away to name by weekday. */
function dayAndMonth(dayNumber: number): string {
  const f = fields(dayNumber);
  return `dia ${f.day} de ${MONTHS_LONG[f.month]}`;
}

/**
 * The phrase after "Qual a boa" in the Explorar header for the selected date: "hoje", "amanhã", "depois de amanhã",
 * "na sexta", "no fim de semana"... Days are SP nights (before 06:00 it is still yesterday's night), so the words are
 * relative to `nightDayNumber(nowMs)`. A weekday is only used up to 6 days ahead; further out it would be ambiguous
 * ("sábado" this week or next?), so the date is spelled out. The default "any day" reads as "hoje", as it always did.
 */
export function dateHeadline(range: DateRange, days: DayRange | null, nowMs: number): string {
  switch (range) {
    case 'hoje':
    case 'qualquer':
      return 'hoje';
    case 'amanha':
      return 'amanhã';
    case 'fim-de-semana':
      return 'no fim de semana';
    case 'proxima-semana':
      return 'na semana que vem';
    default:
      break;
  }
  const d = normalizeDays(days);
  const from = d ? dayNumberOf(d.from) : null;
  const to = d ? dayNumberOf(d.to) : null;
  if (from === null || to === null) return 'hoje';

  const today = nightDayNumber(nowMs);
  const within = (n: number) => n - today >= 0 && n - today <= 6;

  if (from === to) {
    const offset = from - today;
    if (offset === 0) return 'hoje';
    if (offset === 1) return 'amanhã';
    if (offset === 2) return 'depois de amanhã';
    return within(from) ? WEEKDAY_WITH_PREPOSITION[fields(from).weekday] : dayAndMonth(from);
  }
  if (within(from) && within(to)) return `de ${WEEKDAYS_LONG[fields(from).weekday]} a ${WEEKDAYS_LONG[fields(to).weekday]}`;
  const f = fields(from);
  const t = fields(to);
  return f.month === t.month
    ? `de ${f.day} a ${t.day} de ${MONTHS_LONG[t.month]}`
    : `de ${f.day} de ${MONTHS_LONG[f.month]} a ${t.day} de ${MONTHS_LONG[t.month]}`;
}

/** Quick picks shown at the top of the sheet, in order. */
export const QUICK_RANGES: { value: Exclude<DateRange, 'datas'>; label: string }[] = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'amanha', label: 'Amanhã' },
  { value: 'fim-de-semana', label: 'Fim de semana' },
  { value: 'proxima-semana', label: 'Próxima semana' },
  { value: 'qualquer', label: 'Qualquer dia' },
];

// pt-BR formatters. Deterministic: fixed America/Sao_Paulo (UTC-3, no DST since 2019); no Intl.

const SP_OFFSET_MS = -3 * 3600_000;
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export type NowLike = Date | string | number;

export function toMs(now: NowLike): number {
  return typeof now === 'object' ? now.getTime() : typeof now === 'string' ? Date.parse(now) : now;
}

/** Shifts a timestamp so that UTC getters return São Paulo wall-clock fields. */
export function spParts(ms: number) {
  const d = new Date(ms + SP_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    weekday: d.getUTCDay(),
    dayNumber: Math.floor((ms + SP_OFFSET_MS) / 86_400_000),
  };
}

function groupThousands(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatBRL(value: number): string {
  const negative = value < 0;
  const cents = Math.round(Math.abs(value) * 100);
  const int = Math.floor(cents / 100);
  const frac = String(cents % 100).padStart(2, '0');
  return `${negative ? '-' : ''}R$ ${groupThousands(String(int))},${frac}`;
}

function formatBRLShort(value: number): string {
  if (Number.isInteger(value)) return `R$ ${groupThousands(String(value))}`;
  return formatBRL(value);
}

export function formatPriceLabel(priceMin: number | null, priceMax: number | null, isFree: boolean): string {
  if (isFree) return 'Grátis';
  if (priceMin == null && priceMax == null) return 'Preço a confirmar';
  const lo = priceMin ?? priceMax!;
  const hi = priceMax ?? priceMin!;
  if (lo === hi) return formatBRLShort(lo);
  return `${formatBRLShort(Math.min(lo, hi))} a ${formatBRLShort(Math.max(lo, hi))}`;
}

export function formatDistance(km: number): string {
  const rounded = Math.round(km * 10) / 10;
  if (km < 0.95) return `${Math.round(km * 1000)} m`;
  return `${rounded.toFixed(1).replace('.', ',')} km`;
}

function formatHour(hour: number, minute: number): string {
  return minute === 0 ? `${hour}h` : `${hour}h${String(minute).padStart(2, '0')}`;
}

export function formatEventDate(iso: string, now: NowLike = Date.now()): string {
  const p = spParts(Date.parse(iso));
  const time = formatHour(p.hour, p.minute);
  const diffDays = p.dayNumber - spParts(toMs(now)).dayNumber;
  if (diffDays === 0) return `Hoje · ${time}`;
  if (diffDays === 1) return `Amanhã · ${time}`;
  return `${WEEKDAYS[p.weekday]}, ${p.day} ${MONTHS[p.month]} · ${time}`;
}

export function formatRelative(iso: string, now: NowLike = Date.now()): string {
  const diff = Date.parse(iso) - toMs(now);
  const abs = Math.abs(diff);
  let text: string;
  if (abs < 60_000) return 'agora';
  if (abs < 3600_000) text = `${Math.floor(abs / 60_000)} min`;
  else if (abs < 86_400_000) text = `${Math.floor(abs / 3600_000)} h`;
  else {
    const days = Math.floor(abs / 86_400_000);
    text = `${days} ${days === 1 ? 'dia' : 'dias'}`;
  }
  return diff > 0 ? `em ${text}` : `há ${text}`;
}

export function formatCountdown(iso: string, now: NowLike = Date.now()): string {
  const diff = Date.parse(iso) - toMs(now);
  if (diff <= 0) return 'Agora';
  const mins = Math.floor(diff / 60_000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
}

// Small pure parsers shared by adapters and the normalizer: BRL prices, free detection, timestamps.
import { fold } from './text.js';

/** Brazil (Espírito Santo) has no DST since 2019: local time is a fixed UTC-3. */
export const LOCAL_OFFSET = '-03:00';

/**
 * Parses a BRL amount. Accepts "R$ 1.234,56", "40", "40,5", "40.00" (dot = decimal when followed by 1-2 digits),
 * "1.500" (dot = thousands when followed by exactly 3 digits). Returns null when no number is found.
 */
export function parseBRL(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') return Number.isFinite(input) && input >= 0 ? round2(input) : null;
  const m = input.replace(/\s/g, '').match(/\d[\d.,]*/);
  if (!m) return null;
  let s = m[0].replace(/[.,]+$/, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? round2(n) : null;
}
const round2 = (n: number) => Math.round(n * 100) / 100;

const FREE_RE = /\b(gratuit[oa]s?|gratis|entrada franca|entrada livre|free|sem custo|ingresso solidario)\b/;
export function looksFree(text: string | undefined): boolean {
  return !!text && FREE_RE.test(fold(text));
}

/** All BRL amounts mentioned in free text ("R$ 30", "R$ 1.200,00"). */
export function pricesInText(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/R\$\s*(\d[\d.,]*)/g)) {
    const n = parseBRL(m[1]);
    if (n !== null) out.push(n);
  }
  return out;
}

const HAS_ZONE = /(Z|[+-]\d{2}:?\d{2})$/i;

/**
 * Turns a timestamp into an ISO string with an explicit offset. Local times (no zone) are America/Sao_Paulo (-03:00).
 * Returns null for date-only values (no time of day) or garbage.
 */
export function toOffsetISO(input: string | undefined | null): string | null {
  if (!input) return null;
  const s = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return null; // date only: we do not guess an hour
  let m = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(:\d{2})?(\.\d+)?\s*(Z|[+-]\d{2}:?\d{2})?$/i);
  if (!m) return null;
  let zone = m[5] ?? LOCAL_OFFSET;
  if (/^[+-]\d{4}$/.test(zone)) zone = zone.slice(0, 3) + ':' + zone.slice(3);
  if (zone.toLowerCase() === 'z') zone = 'Z';
  const iso = `${m[1]}T${m[2]}${m[3] ?? ':00'}${zone}`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

/** ISO (any offset) -> canonical UTC ISO "YYYY-MM-DDTHH:mm:ss.sssZ" as in the seed. Null when invalid. */
export function toUTC(isoWithOffset: string): string | null {
  const iso = toOffsetISO(isoWithOffset);
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

export const HTTPS_RE = /^https:\/\/[^\s]+$/i;

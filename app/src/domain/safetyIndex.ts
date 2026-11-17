// Índice de segurança da casa (S2 in docs/MVP-PLANO.md). Server: public.venue_safety_stats (migration 0020); this file
// mirrors its rule for the offline/demo catalog and holds the copy.
//
// Only PUBLISHED "Foi ao evento" reviews (check-in, B5) of events that started in the last 6 months count. Each figure
// shows only from 5 answers, so no single person's answer can be read off the screen.

import type { Review } from './engage';

export const SAFETY_INDEX_MIN = 5;
export const SAFETY_INDEX_WINDOW_MONTHS = 6;

export type FeltSafe = 'sim' | 'em_parte' | 'nao';
export type Harassment = 'nao' | 'sim';
export type StaffHelped = 'sim' | 'nao' | 'nao_precisei';

/** Private answers of a "Foi ao evento" review. Never shown one by one; they only feed the aggregate. */
export interface SafetyAnswers {
  feltSafe?: FeltSafe;
  harassment?: Harassment;
  staffHelped?: StaffHelped;
}

export const SAFETY_QUESTIONS = [
  {
    key: 'feltSafe',
    label: 'Você se sentiu segura?',
    options: [
      { value: 'sim', label: 'Sim' },
      { value: 'em_parte', label: 'Em parte' },
      { value: 'nao', label: 'Não' },
    ],
  },
  {
    key: 'harassment',
    label: 'Sofreu ou viu assédio?',
    options: [
      { value: 'nao', label: 'Não' },
      { value: 'sim', label: 'Sim' },
    ],
  },
  {
    key: 'staffHelped',
    label: 'A equipe ajudou quando precisou?',
    options: [
      { value: 'sim', label: 'Sim' },
      { value: 'nao', label: 'Não' },
      { value: 'nao_precisei', label: 'Não precisei' },
    ],
  },
] as const satisfies readonly { key: keyof SafetyAnswers; label: string; options: readonly { value: string; label: string }[] }[];

const VALID: { [K in keyof SafetyAnswers]-?: readonly string[] } = {
  feltSafe: ['sim', 'em_parte', 'nao'],
  harassment: ['nao', 'sim'],
  staffHelped: ['sim', 'nao', 'nao_precisei'],
};

/** Known answers only; anything else is dropped. */
export function cleanSafetyAnswers(v: unknown): SafetyAnswers {
  if (!v || typeof v !== 'object') return {};
  const out: SafetyAnswers = {};
  for (const k of Object.keys(VALID) as (keyof SafetyAnswers)[]) {
    const x = (v as Record<string, unknown>)[k];
    if (typeof x === 'string' && VALID[k].includes(x)) (out as Record<string, string>)[k] = x;
  }
  return out;
}

/** Wire format of reviews.safety (snake_case keys). */
export function safetyToRow(a: SafetyAnswers): Record<string, string> {
  const c = cleanSafetyAnswers(a);
  const row: Record<string, string> = {};
  if (c.feltSafe) row.felt_safe = c.feltSafe;
  if (c.harassment) row.harassment = c.harassment;
  if (c.staffHelped) row.staff_helped = c.staffHelped;
  return row;
}

export interface VenueSafetyStats {
  /** Reviews that rated the "Segurança" topic. */
  sampleSize: number;
  /** Average 1..5 with one decimal, or null below SAFETY_INDEX_MIN. */
  average: number | null;
  /** How many answered "Você se sentiu segura?". */
  feltSafeN: number;
  /** Share 0..1 who answered "Sim", or null below SAFETY_INDEX_MIN. */
  feltSafeShare: number | null;
}

export const EMPTY_SAFETY_STATS: VenueSafetyStats = { sampleSize: 0, average: null, feltSafeN: 0, feltSafeShare: null };

/** Start of the window: same calendar arithmetic as Postgres `now() - interval '6 months'`. */
export function windowStart(nowMs: number): number {
  const d = new Date(nowMs);
  d.setUTCMonth(d.getUTCMonth() - SAFETY_INDEX_WINDOW_MONTHS);
  return d.getTime();
}

/** Mirror of venue_safety_stats. `startsAt` gives each review's event start (reviews of other venues: undefined). */
export function computeSafetyStats(
  reviews: readonly (Review & { safety?: SafetyAnswers })[],
  startsAt: (eventId: string) => string | undefined,
  nowMs: number,
): VenueSafetyStats {
  const from = windowStart(nowMs);
  const base = reviews.filter((r) => {
    const s = startsAt(r.eventId);
    if (!s || r.status !== 'published' || !r.attended) return false;
    const t = Date.parse(s);
    return t > from && t <= nowMs;
  });
  const scored = base.map((r) => r.topics.seguranca).filter((v): v is NonNullable<typeof v> => v != null);
  const felt = base.map((r) => r.safety?.feltSafe).filter((v): v is FeltSafe => !!v);
  const avg = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : 0;
  return {
    sampleSize: scored.length,
    average: scored.length >= SAFETY_INDEX_MIN ? Math.round(avg * 10) / 10 : null,
    feltSafeN: felt.length,
    feltSafeShare: felt.length >= SAFETY_INDEX_MIN ? Math.round((felt.filter((f) => f === 'sim').length / felt.length) * 100) / 100 : null,
  };
}

const oneDecimal = (n: number) => n.toFixed(1).replace('.', ',');

/** Headline for the venue page, e.g. "4,3 de 5". Null when there is no index yet. */
export const safetyAverageLabel = (s: VenueSafetyStats) => (s.average == null ? null : `${oneDecimal(s.average)} de 5`);

export function safetyIndexCaption(s: VenueSafetyStats): string {
  if (s.average == null) {
    return `Ainda não há avaliações suficientes de quem foi. O índice aparece a partir de ${SAFETY_INDEX_MIN} avaliações com check-in nos últimos ${SAFETY_INDEX_WINDOW_MONTHS} meses.`;
  }
  const who = s.sampleSize === 1 ? '1 pessoa' : `${s.sampleSize} pessoas`;
  return `Segundo ${who} que fizeram check-in nos últimos ${SAFETY_INDEX_WINDOW_MONTHS} meses.`;
}

export const feltSafeLabel = (s: VenueSafetyStats) =>
  s.feltSafeShare == null ? null : `${Math.round(s.feltSafeShare * 100)}% se sentiram seguras`;

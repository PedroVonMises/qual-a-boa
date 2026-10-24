import type { CrowdLevel, LiveReport, MusicLevel, QueueLevel } from '@/domain/engage';

/** Reports older than this are shown as stale (never as current status). */
export const STALE_MS = 2 * 3600_000;
const FUTURE_TOLERANCE_MS = 5 * 60_000;

export const QUEUE_LABEL: Record<QueueLevel, string> = { none: 'Sem fila', short: 'Curta', long: 'Longa' };
export const CROWD_LABEL: Record<CrowdLevel, string> = { empty: 'Vazia', busy: 'Movimentada', full: 'Cheia' };
export const MUSIC_LABEL: Record<MusicLevel, string> = { warmup: 'Aquecendo', good: 'Boa', peak: 'No auge' };
/** Crowd as "n de 5" so the level is readable without color. */
export const CROWD_SCORE: Record<CrowdLevel, number> = { empty: 1, busy: 3, full: 5 };

export interface Metric<T> {
  value: T;
  /** ISO time of the newest report behind the value. */
  at: string;
  /** Reports behind the value (fresh ones; 1 when only an old report exists). */
  n: number;
  stale: boolean;
}

export interface LiveSummary {
  queue?: Metric<QueueLevel>;
  crowd?: Metric<CrowdLevel>;
  music?: Metric<MusicLevel>;
  price?: Metric<number>;
  /** Fresh reports in the last 2 h. */
  freshCount: number;
  /** Newest report overall (ISO), fresh or not. */
  lastAt?: string;
  /** True when nothing is fresh (or nothing exists). */
  allStale: boolean;
}

const ageMs = (iso: string, nowMs: number) => nowMs - Date.parse(iso);
const isFresh = (r: LiveReport, nowMs: number) => {
  const a = ageMs(r.at, nowMs);
  return a <= STALE_MS && a >= -FUTURE_TOLERANCE_MS;
};

function pick<T extends string>(rs: LiveReport[], key: 'queue' | 'crowd' | 'music', nowMs: number): Metric<T> | undefined {
  const withKey = rs.filter((r) => r[key] !== undefined).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  if (!withKey.length) return undefined;
  const fresh = withKey.filter((r) => isFresh(r, nowMs));
  if (!fresh.length) return { value: withKey[0][key] as T, at: withKey[0].at, n: 1, stale: true };
  const counts = new Map<string, number>();
  for (const r of fresh) counts.set(r[key] as string, (counts.get(r[key] as string) ?? 0) + 1);
  const best = Math.max(...counts.values());
  // Tie: the most recent report among the tied values wins (fresh is newest-first).
  const winner = fresh.find((r) => counts.get(r[key] as string) === best)!;
  return { value: winner[key] as T, at: fresh[0].at, n: fresh.length, stale: false };
}

function pickPrice(rs: LiveReport[], nowMs: number): Metric<number> | undefined {
  const withKey = rs.filter((r) => r.priceAtDoor !== undefined).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  if (!withKey.length) return undefined;
  const fresh = withKey.filter((r) => isFresh(r, nowMs));
  if (!fresh.length) return { value: withKey[0].priceAtDoor!, at: withKey[0].at, n: 1, stale: true };
  const sorted = fresh.map((r) => r.priceAtDoor!).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return { value: Math.round(median * 100) / 100, at: fresh[0].at, n: fresh.length, stale: false };
}

export function summarize(reports: LiveReport[], nowMs: number): LiveSummary {
  const sorted = [...reports].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const freshCount = sorted.filter((r) => isFresh(r, nowMs)).length;
  return {
    queue: pick<QueueLevel>(sorted, 'queue', nowMs),
    crowd: pick<CrowdLevel>(sorted, 'crowd', nowMs),
    music: pick<MusicLevel>(sorted, 'music', nowMs),
    price: pickPrice(sorted, nowMs),
    freshCount,
    lastAt: sorted[0]?.at,
    allStale: freshCount === 0,
  };
}

/** "Relatos de 14 pessoas, o último há 12 min." / stale / empty copy. */
export function sampleLine(s: LiveSummary, relative: (iso: string) => string): string {
  if (!s.lastAt) return 'Ainda sem relatos para este evento. Quem estiver lá pode ser o primeiro a contar.';
  if (s.allStale) return `Sem relatos recentes. O último foi ${relative(s.lastAt)}; os dados abaixo estão desatualizados.`;
  const who = s.freshCount === 1 ? 'Relato de 1 pessoa' : `Relatos de ${s.freshCount} pessoas`;
  return `${who}, o último ${relative(s.lastAt)}. Pode estar desatualizado.`;
}

/** Illustrative community reports, only ever used for the fictional Casa Maré. */
export function demoReports(eventId: string, nowMs: number): LiveReport[] {
  const ago = [12, 18, 25, 31, 40, 47, 55, 63, 70, 74, 80, 85, 88, 92];
  const queue: QueueLevel[] = ['short', 'short', 'long', 'short', 'short', 'none', 'short', 'short', 'long', 'short', 'short', 'short', 'none', 'short'];
  const crowd: CrowdLevel[] = ['full', 'full', 'busy', 'full', 'full', 'busy', 'full', 'busy', 'full', 'full', 'busy', 'full', 'busy', 'full'];
  return ago.map((m, i) => ({
    id: `demo-${eventId}-${i}`,
    eventId,
    at: new Date(nowMs - m * 60_000).toISOString(),
    queue: queue[i],
    crowd: crowd[i],
    ...(i % 3 === 0 ? { music: 'peak' as MusicLevel } : i % 3 === 1 ? { music: 'good' as MusicLevel } : {}),
    ...(i % 4 === 0 ? { priceAtDoor: 30 } : {}),
  }));
}

export interface ChecklistItem {
  key: string;
  label: string;
}

export function checklistFor(ageMin: number, hasTicket: boolean): ChecklistItem[] {
  return [
    { key: 'doc', label: ageMin >= 18 ? 'Documento com foto (18+)' : `Documento com foto (${ageMin}+)` },
    { key: 'ticket', label: hasTicket ? 'Ingresso salvo no celular' : 'Ingresso comprado e salvo no celular' },
    { key: 'ride', label: 'Combinar a volta para casa' },
  ];
}

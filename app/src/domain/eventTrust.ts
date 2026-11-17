// Fonte, conferência e dress code do evento (item 14 of docs/MVP-PLANO.md, migration 0023).

import type { EventItem } from './types';

export const DRESS_CODE_MIN = 2;
export const DRESS_CODE_MAX = 80;

type Trust = Pick<EventItem, 'sourceUrl' | 'verifiedAt' | 'dressCode'>;

/** Known, well-formed values only; absent keys stay absent so events without them stay deep-equal. */
export function cleanEventTrust(v: { sourceUrl?: unknown; verifiedAt?: unknown; dressCode?: unknown }): Trust {
  const out: Trust = {};
  if (typeof v.sourceUrl === 'string' && /^https:\/\/[^@/\s]+(\/\S*)?$/i.test(v.sourceUrl)) out.sourceUrl = v.sourceUrl;
  if (typeof v.verifiedAt === 'string' && !Number.isNaN(Date.parse(v.verifiedAt))) out.verifiedAt = new Date(v.verifiedAt).toISOString();
  if (typeof v.dressCode === 'string') {
    const d = v.dressCode.trim().replace(/\s+/g, ' ');
    if (d.length >= DRESS_CODE_MIN && d.length <= DRESS_CODE_MAX) out.dressCode = d;
  }
  return out;
}

/** "sympla.com.br" from the source link. */
export function sourceHost(url: string): string {
  const m = /^https:\/\/([^/?#]+)/i.exec(url);
  return (m?.[1] ?? url).replace(/^www\./i, '').toLowerCase();
}

const ddmm = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });

/**
 * Provenance line for the event page, or null when there is nothing to say. Ingested: "Informações de sympla.com.br,
 * conferidas em 09/11". Sent by the casa and approved: "Enviado pela casa e conferido pela equipe em 12/11".
 */
export function provenanceLabel(e: Trust): string | null {
  if (e.sourceUrl) {
    const from = `Informações de ${sourceHost(e.sourceUrl)}`;
    return e.verifiedAt ? `${from}, conferidas em ${ddmm(e.verifiedAt)}` : from;
  }
  return e.verifiedAt ? `Conferido pela equipe em ${ddmm(e.verifiedAt)}` : null;
}

/** Form check: empty is fine (not informed). */
export function dressCodeError(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  if (t.length < DRESS_CODE_MIN) return 'Escreva um pouco mais.';
  if (t.length > DRESS_CODE_MAX) return `Use até ${DRESS_CODE_MAX} caracteres.`;
  return null;
}

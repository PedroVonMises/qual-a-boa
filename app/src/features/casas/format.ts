// Pure helpers of the Casas screens: masks, date/time parsing (São Paulo, UTC-3, no DST), festa step validation and
// status labels. Rules mirror submit_event in supabase/migrations/0015_venue_accounts.sql.

import { formatEventDate, spParts } from '@/domain/format';
import { isValidCnpj, onlyDigits, partyMonthLabel, type SubscriptionStatus, type VenueAccount } from '@/domain/casas';
import type { BadgeTone } from '@/ui';
import type { EventStatus, SearchItem, Venue } from '@/domain/types';
import type { AddressDraft } from '@/features/dadosCadastrais/format';

const SP_OFFSET_MS = 3 * 3_600_000;
const DAY = 86_400_000;

export const pad2 = (n: number) => String(n).padStart(2, '0');

/** "dd/mm" (São Paulo). */
export function dayMonth(iso: string): string {
  const p = spParts(Date.parse(iso));
  return `${pad2(p.day)}/${pad2(p.month + 1)}`;
}

/** "dd/mm/aaaa" (São Paulo). */
export function fullDate(iso: string): string {
  const p = spParts(Date.parse(iso));
  return `${pad2(p.day)}/${pad2(p.month + 1)}/${p.year}`;
}

/** "Novembro" for "2026-11". */
export const monthName = (key: string) => partyMonthLabel(key).split(' ')[0];

/** Progressive "DD/MM/AAAA". */
export function maskDate(raw: string): string {
  const d = onlyDigits(raw).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** Progressive "HH:MM". */
export function maskTime(raw: string): string {
  const d = onlyDigits(raw).slice(0, 4);
  return d.length <= 2 ? d : `${d.slice(0, 2)}:${d.slice(2)}`;
}

/** "14/11/2026" -> [2026, 10, 14] (month 0-based), or null when it is not a real date. */
export function parseDate(s: string): [number, number, number] | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const [day, month, year] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const d = new Date(Date.UTC(year, month, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month && d.getUTCDate() === day ? [year, month, day] : null;
}

/** "23:30" -> minutes, or null. */
export function parseTime(s: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/** São Paulo wall clock -> UTC ms. */
export function spWallToMs(ymd: [number, number, number], minutes: number): number {
  return Date.UTC(ymd[0], ymd[1], ymd[2]) + minutes * 60_000 + SP_OFFSET_MS;
}

/** "dd/mm/aaaa" of the first Friday of a `YYYY-MM` month. */
export function firstFridayOf(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const day = 1 + ((5 - first.getUTCDay() + 7) % 7);
  return `${pad2(day)}/${pad2(m)}/${y}`;
}

/** Brazilian money typed as "40" or "40,50" -> number, or null. */
export function parseMoney(s: string): number | null {
  const t = s.trim().replace(/^R\$\s*/, '').replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Number(t);
}

export const TICKET_URL_RE = /^https:\/\/[^@/\s]+(\/\S*)?$/i;

/** WhatsApp as the server stores it: +55 + DDD + number. */
export const whatsappE164 = (raw: string) => `+55${onlyDigits(raw).slice(0, 11)}`;

// --- Festa form -------------------------------------------------------------------------------------------------

export interface PosterPick {
  uri: string;
  mimeType?: string | null;
  size?: number | null;
}

export interface FestaDraft {
  title: string;
  date: string;
  start: string;
  end: string;
  genres: string[];
  free: boolean;
  priceMin: string;
  priceMax: string;
  ticketUrl: string;
  ageMin: string;
  lineup: string[];
  poster: PosterPick | null;
}

export const EMPTY_FESTA: FestaDraft = {
  title: '',
  date: '',
  start: '23:00',
  end: '',
  genres: [],
  free: false,
  priceMin: '',
  priceMax: '',
  ticketUrl: '',
  ageMin: '18',
  lineup: [],
  poster: null,
};

export type FestaField = 'title' | 'date' | 'start' | 'end' | 'genres' | 'priceMin' | 'priceMax' | 'ticketUrl' | 'ageMin';
export type FestaErrors = Partial<Record<FestaField, string>>;

export const MAX_GENRES = 3;

/** Start/end instants of the draft, or null when the date/time fields are not valid yet. End past midnight rolls over. */
export function festaTimes(d: Pick<FestaDraft, 'date' | 'start' | 'end'>): { startsAt: string; endsAt: string | null } | null {
  const ymd = parseDate(d.date);
  const start = parseTime(d.start);
  if (!ymd || start === null) return null;
  const startMs = spWallToMs(ymd, start);
  const end = d.end.trim() ? parseTime(d.end) : null;
  let endMs: number | null = null;
  if (end !== null) {
    endMs = spWallToMs(ymd, end);
    if (endMs <= startMs) endMs += DAY;
  }
  return { startsAt: new Date(startMs).toISOString(), endsAt: endMs === null ? null : new Date(endMs).toISOString() };
}

export function validateFestaStep(step: number, d: FestaDraft, nowMs: number = Date.now()): FestaErrors {
  const e: FestaErrors = {};
  if (step === 1) {
    const t = d.title.trim().length;
    if (t < 3 || t > 120) e.title = 'Dê um nome de 3 a 120 letras.';
    if (!parseDate(d.date)) e.date = 'Use o formato DD/MM/AAAA, como 14/11/2026.';
    if (parseTime(d.start) === null) e.start = 'Use o formato HH:MM, como 23:00.';
    if (d.end.trim() && parseTime(d.end) === null) e.end = 'Use o formato HH:MM, como 05:00. Ou deixe em branco.';
    else if (d.end.trim() && d.end.trim() === d.start.trim()) e.end = 'O fim precisa ser diferente do início.';
    const times = festaTimes(d);
    if (!e.date && !e.start && times && Date.parse(times.startsAt) <= nowMs) e.date = 'Escolha uma data que ainda não passou.';
    if (d.genres.length < 1 || d.genres.length > MAX_GENRES) e.genres = `Escolha de 1 a ${MAX_GENRES} estilos.`;
  }
  if (step === 2) {
    if (!d.free) {
      const min = parseMoney(d.priceMin);
      if (min === null || min > 100000) e.priceMin = 'Digite o preço em reais, como 40 ou 40,50.';
      if (d.priceMax.trim()) {
        const max = parseMoney(d.priceMax);
        if (max === null || max > 100000) e.priceMax = 'Digite o preço em reais, como 80.';
        else if (min !== null && max < min) e.priceMax = 'O máximo não pode ser menor que o mínimo.';
      }
    }
    if (d.ticketUrl.trim() && !TICKET_URL_RE.test(d.ticketUrl.trim())) e.ticketUrl = 'O link precisa começar com https://';
    const age = Number(d.ageMin);
    if (!/^\d+$/.test(d.ageMin.trim()) || age < 18 || age > 21) e.ageMin = 'A idade mínima vai de 18 a 21 anos.';
  }
  return e;
}

/** Steps of the first error code from the server, so the form can jump back to the field. */
export const ERROR_STEP: Partial<Record<string, number>> = {
  starts_in_past: 1,
  beyond_paid_period: 1,
  quota_exceeded: 1,
  invalid_genre: 1,
  invalid_price: 2,
  invalid_ticket_url: 2,
  invalid_age: 2,
  invalid_poster: 3,
};

/** Price line for the preview card. */
export function draftPriceLabel(d: FestaDraft): string {
  if (d.free) return 'Grátis';
  const min = parseMoney(d.priceMin);
  const max = d.priceMax.trim() ? parseMoney(d.priceMax) : null;
  const brl = (n: number) => (Number.isInteger(n) ? `R$ ${n}` : `R$ ${n.toFixed(2).replace('.', ',')}`);
  if (min === null) return 'Preço a confirmar';
  return max !== null && max !== min ? `${brl(min)} a ${brl(max)}` : brl(min);
}

export const draftDateLabel = (d: FestaDraft, nowMs: number = Date.now()) => {
  const t = festaTimes(d);
  return t ? formatEventDate(t.startsAt, nowMs) : '';
};

// --- Labels -----------------------------------------------------------------------------------------------------

export const FESTA_BADGE: Record<EventStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: 'Rascunho', tone: 'neutral' },
  pending_review: { label: 'Em revisão', tone: 'neutral' },
  published: { label: 'Publicada', tone: 'success' },
  rejected: { label: 'Recusada', tone: 'danger' },
  cancelled: { label: 'Cancelada', tone: 'neutral' },
};

export const SUBSCRIPTION_BADGE: Record<SubscriptionStatus, { label: string; tone: BadgeTone }> = {
  incomplete: { label: 'Pagamento pendente', tone: 'neutral' },
  active: { label: 'Assinatura ativa', tone: 'success' },
  past_due: { label: 'Pagamento atrasado', tone: 'danger' },
  canceled: { label: 'Assinatura cancelada', tone: 'neutral' },
};

/** Venue name of an account (catalog venue, or the proposed one while it is in review). */
export const accountVenueName = (a: Pick<VenueAccount, 'venue' | 'proposedVenue' | 'legalName'>) =>
  a.venue?.name || a.proposedVenue?.name || a.legalName;

// --- Vincular -----------------------------------------------------------------------------------------------

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** Venues (from the event search, which matches venue names) whose name or bairro contains the query. */
export function matchVenues(items: SearchItem[], query: string): Venue[] {
  const q = fold(query);
  if (!q) return [];
  const byId = new Map<string, Venue>();
  for (const it of items) {
    if (fold(it.venue.name).includes(q) || fold(it.venue.area).includes(q)) byId.set(it.venue.id, it.venue);
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

/** Text the server keeps as the proposed address: "Rua X, 12, apto 3 - Vitória/ES". */
export const proposedAddress = (d: AddressDraft) =>
  `${[d.street.trim(), d.number.trim(), d.complement.trim()].filter(Boolean).join(', ')} - ${d.city.trim()}/${d.uf.trim().toUpperCase()}`;

export interface CompanyForm {
  cnpj: string;
  legalName: string;
  contactName: string;
  whatsapp: string;
  responsible: boolean;
}

export type CompanyField = 'cnpj' | 'legalName' | 'contactName' | 'whatsapp' | 'responsible';
export type CompanyErrors = Partial<Record<CompanyField, string>>;

/** Same limits as claim_venue. */
export function companyErrors(c: CompanyForm): CompanyErrors {
  const e: CompanyErrors = {};
  const cnpj = onlyDigits(c.cnpj);
  if (cnpj.length !== 14) e.cnpj = 'Digite os 14 números do CNPJ.';
  else if (!isValidCnpj(cnpj)) e.cnpj = 'CNPJ inválido. Confira os números.';
  const legal = c.legalName.trim().length;
  if (legal < 2 || legal > 160) e.legalName = 'Digite a razão social como está no CNPJ.';
  const contact = c.contactName.trim().length;
  if (contact < 2 || contact > 120) e.contactName = 'Digite o nome de quem responde pela casa.';
  const phone = onlyDigits(c.whatsapp).length;
  if (phone !== 10 && phone !== 11) e.whatsapp = 'Digite o DDD e o número, como (27) 99999-0000.';
  if (!c.responsible) e.responsible = 'Confirme que você é responsável pela casa.';
  return e;
}

/** Next charge after a payment made today: same day next month (Stripe bills monthly on the start date). */
export function nextChargeDate(nowMs: number = Date.now()): string {
  const d = new Date(nowMs);
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes()));
  return next.toISOString();
}


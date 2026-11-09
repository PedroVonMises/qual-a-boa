// Plano Casas Noturnas: types, plan constants, quota month rule and pt-BR copy for the server error codes.
// Pure; mirrors supabase/migrations/0015_venue_accounts.sql (keep both in sync).

import { monthTitle } from './calendar';
import { dayString, nightDayNumber } from './filters';
import type { EventStatus } from './types';

export const PLAN = { code: 'casa_mensal', name: 'Plano Casas Noturnas', priceCents: 29900, eventsPerMonth: 4 } as const;

export type VenueAccountStatus = 'pending' | 'verified' | 'rejected';
export type VenueRole = 'owner' | 'editor';
export type SubscriptionStatus = 'incomplete' | 'active' | 'past_due' | 'canceled';

/** A casa that is not in the catalog yet (claim without venue id). */
export interface ProposedVenue {
  name: string;
  address: string;
  bairro?: string;
  cep?: string;
  lat?: number;
  lng?: number;
}

export interface Subscription {
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface QuotaUsage {
  /** Party month, `YYYY-MM`. */
  month: string;
  used: number;
  limit: number;
}

/** One row of the casa panel (RPC my_venue_accounts). */
export interface VenueAccount {
  id: string;
  role: VenueRole;
  status: VenueAccountStatus;
  cnpj: string;
  legalName: string;
  contactName: string;
  whatsapp: string;
  reviewNote: string | null;
  createdAt: string;
  venue: { id: string; slug: string; name: string; area: string } | null;
  proposedVenue: ProposedVenue | null;
  plan: { code: string; priceCents: number; eventsPerMonth: number };
  /** Null until the first checkout. */
  subscription: Subscription | null;
  currentMonth: QuotaUsage;
  nextMonth: QuotaUsage;
  /** Server verdict: verified + venue + live subscription. Quota and paid period are checked per festa. */
  canSubmit: boolean;
}

export interface ClaimVenueInput {
  venueId: string | null;
  proposed: ProposedVenue | null;
  cnpj: string;
  legalName: string;
  contactName: string;
  whatsapp: string;
}

/** Payload of submit_event (snake_case on the wire). */
export interface EventSubmission {
  title: string;
  startsAt: string;
  endsAt?: string | null;
  isFree: boolean;
  priceMin?: number | null;
  priceMax?: number | null;
  ticketUrl?: string | null;
  ageMin?: number;
  genreSlugs: string[];
  posterPath?: string | null;
}

/** A festa of the account as members see it (any status). */
export interface VenueEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  status: EventStatus;
  reviewNote: string | null;
  isFree: boolean;
  priceMin: number | null;
  priceMax: number | null;
  ticketUrl: string | null;
  ageMin: number;
  posterPath: string | null;
}

// --- Rules ------------------------------------------------------------------------------------------------------

/** Statuses that use a slot of the month. draft and rejected do not (rejected gives it back). */
export const QUOTA_STATUSES: readonly EventStatus[] = ['pending_review', 'published', 'cancelled'];
export const countsForQuota = (s: EventStatus) => QUOTA_STATUSES.includes(s);

/** Party month `YYYY-MM` of a festa: São Paulo calendar month of its night (before 06:00 is the previous day). */
export function partyMonthKey(startsAtIso: string): string {
  return dayString(nightDayNumber(Date.parse(startsAtIso))).slice(0, 7);
}

/** "Novembro 2026" for a `YYYY-MM` key. */
export function partyMonthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return monthTitle({ year: y, month: m - 1 });
}

/** `YYYY-MM` + n months. */
export function addMonthKey(key: string, n: number): string {
  const [y, m] = key.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** Plain São Paulo calendar month of an instant (used for current_period_end, no night rule). */
function spMonthKey(iso: string): string {
  return new Date(Date.parse(iso) - 3 * 3_600_000).toISOString().slice(0, 7);
}

/** "R$ 299" (cents only when present: "R$ 299,90"). */
export function formatPlanPrice(cents: number = PLAN.priceCents): string {
  const int = Math.floor(cents / 100);
  const frac = cents % 100;
  const intStr = String(int).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return frac ? `R$ ${intStr},${String(frac).padStart(2, '0')}` : `R$ ${intStr}`;
}

/** Same rule as SQL subscription_allows: active, or past_due still inside the paid period. */
export function subscriptionAllows(sub: Subscription | null, nowMs: number = Date.now()): boolean {
  if (!sub) return false;
  if (sub.status === 'active') return true;
  return sub.status === 'past_due' && !!sub.currentPeriodEnd && Date.parse(sub.currentPeriodEnd) > nowMs;
}

/**
 * Client-side pre-check of a festa date (the server re-checks everything inside submit_event). Returns the error code
 * the server would raise, or null. `used` is the usage of the festa's party month, when known.
 */
export function submissionBlocker(
  account: Pick<VenueAccount, 'status' | 'venue' | 'subscription' | 'plan'>,
  startsAtIso: string,
  used: number | null,
  nowMs: number = Date.now(),
): CasasErrorCode | null {
  if (account.status !== 'verified') return 'account_not_verified';
  if (!account.venue) return 'venue_missing';
  const sub = account.subscription;
  if (!subscriptionAllows(sub, nowMs)) return 'subscription_inactive';
  const starts = Date.parse(startsAtIso);
  if (!Number.isFinite(starts)) return 'invalid_payload';
  if (starts <= nowMs) return 'starts_in_past';
  const end = sub!.currentPeriodEnd;
  if (!end) return 'beyond_paid_period';
  if (sub!.cancelAtPeriodEnd ? starts > Date.parse(end) : partyMonthKey(startsAtIso) > spMonthKey(end)) return 'beyond_paid_period';
  if (used !== null && used >= account.plan.eventsPerMonth) return 'quota_exceeded';
  return null;
}

// --- CNPJ -------------------------------------------------------------------------------------------------------

export const onlyDigits = (s: string) => s.replace(/\D/g, '');

/** Same algorithm as SQL is_valid_cnpj. Accepts masked input. */
export function isValidCnpj(raw: string): boolean {
  const d = onlyDigits(raw);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const dv = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, w, i) => acc + w * Number(d[i]), 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(12) === Number(d[12]) && dv(13) === Number(d[13]);
}

/** "11.222.333/0001-81" (progressive while typing). */
export function formatCnpj(raw: string): string {
  const d = onlyDigits(raw).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

// --- Errors -----------------------------------------------------------------------------------------------------

export type CasasErrorCode =
  | 'not_authenticated'
  | 'not_member'
  | 'not_owner'
  | 'account_not_verified'
  | 'account_rejected'
  | 'venue_missing'
  | 'venue_not_found'
  | 'venue_taken'
  | 'cnpj_taken'
  | 'invalid_cnpj'
  | 'invalid_payload'
  | 'invalid_price'
  | 'invalid_ticket_url'
  | 'invalid_age'
  | 'invalid_genre'
  | 'invalid_poster'
  | 'starts_in_past'
  | 'subscription_inactive'
  | 'beyond_paid_period'
  | 'quota_exceeded'
  | 'event_not_found'
  | 'not_cancellable'
  | 'already_subscribed'
  | 'no_customer'
  | 'venue_owner_active'
  | 'poster_too_large'
  | 'poster_type'
  | 'no_backend'
  | 'network';

export const CASAS_ERROR_MESSAGES: Record<CasasErrorCode, string> = {
  not_authenticated: 'Entre na sua conta para continuar.',
  not_member: 'Você não faz parte desta casa.',
  not_owner: 'Só quem é dono da casa pode fazer isso.',
  account_not_verified: 'Sua casa ainda está em análise. Avisamos quando for aprovada.',
  account_rejected: 'O cadastro desta casa não foi aprovado.',
  venue_missing: 'Sua casa ainda não está no mapa. Aguarde a aprovação.',
  venue_not_found: 'Não encontramos essa casa.',
  venue_taken: 'Essa casa já tem um cadastro. Fale com a gente se for sua.',
  cnpj_taken: 'Esse CNPJ já está cadastrado.',
  invalid_cnpj: 'CNPJ inválido. Confira os números.',
  invalid_payload: 'Confira os campos e tente de novo.',
  invalid_price: 'Confira os preços: o máximo não pode ser menor que o mínimo.',
  invalid_ticket_url: 'O link do ingresso precisa começar com https://',
  invalid_age: 'A idade mínima é 18 anos.',
  invalid_genre: 'Escolha até 3 estilos da lista.',
  invalid_poster: 'Não foi possível usar esse cartaz. Envie de novo.',
  starts_in_past: 'Escolha uma data que ainda não passou.',
  subscription_inactive: 'Sua assinatura não está ativa. Assine para cadastrar festas.',
  beyond_paid_period: 'Essa data fica depois do período pago da assinatura.',
  quota_exceeded: `Você já usou as ${PLAN.eventsPerMonth} festas deste mês.`,
  event_not_found: 'Festa não encontrada.',
  not_cancellable: 'Essa festa não pode mais ser retirada.',
  already_subscribed: 'Sua casa já tem uma assinatura ativa.',
  no_customer: 'Ainda não há assinatura para gerenciar.',
  venue_owner_active: 'Você é dono de uma casa com assinatura ativa. Cancele a assinatura ou passe a casa para outra pessoa antes de apagar a conta.',
  poster_too_large: 'O cartaz pode ter até 5 MB.',
  poster_type: 'Envie o cartaz em JPG, PNG ou WebP.',
  no_backend: 'O Plano Casas ainda não está disponível neste app.',
  network: 'Não foi possível concluir agora. Tente de novo em instantes.',
};

const CODES = new Set(Object.keys(CASAS_ERROR_MESSAGES));
export const isCasasErrorCode = (v: unknown): v is CasasErrorCode => typeof v === 'string' && CODES.has(v);

/** pt-BR message for a server code; anything unknown reads as a generic retry message. */
export function casasErrorMessage(code: unknown): string {
  return isCasasErrorCode(code) ? CASAS_ERROR_MESSAGES[code] : CASAS_ERROR_MESSAGES.network;
}

// --- Labels -----------------------------------------------------------------------------------------------------

export const ACCOUNT_STATUS_LABEL: Record<VenueAccountStatus, string> = {
  pending: 'Em análise',
  verified: 'Verificada',
  rejected: 'Não aprovada',
};

export const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  incomplete: 'Pagamento pendente',
  active: 'Ativa',
  past_due: 'Pagamento atrasado',
  canceled: 'Cancelada',
};

export const SUBMISSION_STATUS_LABEL: Record<EventStatus, string> = {
  draft: 'Rascunho',
  pending_review: 'Em análise',
  published: 'Publicada',
  rejected: 'Não aprovada',
  cancelled: 'Cancelada',
};

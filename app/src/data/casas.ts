// Plano Casas Noturnas data layer: RPCs (claim_venue, submit_event, my_venue_accounts, ...), the billing Edge
// Functions and poster uploads. Every call returns a CasasResult and never throws; errors carry a CasasErrorCode that
// domain/casas.ts turns into pt-BR copy.
//
// Without a backend (seed builds, !isRemote()) the same API runs on an in-memory demo store with Casa Maré verified,
// subscribed and with two festas, so the screens work end to end. The demo applies the same rules (quota by party
// month, paid period, statuses) and never touches the network.

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { create } from 'zustand';

import {
  addMonthKey,
  casasErrorMessage,
  countsForQuota,
  isCasasErrorCode,
  isValidCnpj,
  onlyDigits,
  PLAN,
  partyMonthKey,
  submissionBlocker,
  type CasasErrorCode,
  type ClaimVenueInput,
  type EventSubmission,
  type QuotaUsage,
  type SubscriptionStatus,
  type VenueAccount,
  type VenueAccountStatus,
  type VenueEvent,
  type VenueRole,
} from '@/domain/casas';
import type { EventStatus } from '@/domain/types';

import { getSupabase, isRemote } from './supabaseClient';

export type CasasResult<T> = ({ ok: true } & T) | { ok: false; code: CasasErrorCode; error: string };

const fail = (code: CasasErrorCode): { ok: false; code: CasasErrorCode; error: string } => ({ ok: false, code, error: casasErrorMessage(code) });

export const POSTER_BUCKET = 'event-posters';
export const POSTER_MAX_BYTES = 5 * 1024 * 1024;
const POSTER_EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export const casasKeys = {
  all: ['casas'] as const,
  accounts: ['casas', 'accounts'] as const,
  events: (accountId: string) => ['casas', 'events', accountId] as const,
  quota: (accountId: string, month: string) => ['casas', 'quota', accountId, month] as const,
};

function uuid(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Server error -> code: RPCs raise the code as the message; Edge Functions answer `{ error: code }`. */
async function codeOf(err: unknown): Promise<CasasErrorCode> {
  if (!err || typeof err !== 'object') return 'network';
  const e = err as { message?: unknown; hint?: unknown; context?: { json?: () => Promise<unknown> } };
  if (isCasasErrorCode(e.message)) return e.message;
  if (isCasasErrorCode(e.hint)) return e.hint;
  if (typeof e.message === 'string' && /permission denied|JWT/i.test(e.message)) return 'not_authenticated';
  try {
    const body = (await e.context?.json?.()) as { error?: unknown } | undefined;
    if (body && isCasasErrorCode(body.error)) return body.error;
    if (body?.error === 'unauthorized') return 'not_authenticated';
  } catch {
    // Not a JSON body.
  }
  return 'network';
}

// --- Row mapping ----------------------------------------------------------------------------------------------------

interface AccountRow {
  account_id: string;
  role: VenueRole;
  status: VenueAccountStatus;
  cnpj: string;
  legal_name: string;
  contact_name: string;
  whatsapp: string;
  review_note: string | null;
  created_at: string;
  venue_id: string | null;
  venue_slug: string | null;
  venue_name: string | null;
  venue_area: string | null;
  proposed_venue: VenueAccount['proposedVenue'];
  plan_code: string;
  price_cents: number;
  events_per_month: number;
  subscription_status: SubscriptionStatus | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  current_month: string;
  used_current_month: number;
  next_month: string;
  used_next_month: number;
  can_submit: boolean;
}

export function mapAccountRow(r: AccountRow): VenueAccount {
  const limit = r.events_per_month;
  return {
    id: r.account_id,
    role: r.role,
    status: r.status,
    cnpj: r.cnpj,
    legalName: r.legal_name,
    contactName: r.contact_name,
    whatsapp: r.whatsapp,
    reviewNote: r.review_note,
    createdAt: r.created_at,
    venue: r.venue_id ? { id: r.venue_id, slug: r.venue_slug ?? '', name: r.venue_name ?? '', area: r.venue_area ?? '' } : null,
    proposedVenue: r.proposed_venue ?? null,
    plan: { code: r.plan_code, priceCents: r.price_cents, eventsPerMonth: limit },
    subscription: r.subscription_status
      ? {
          status: r.subscription_status,
          currentPeriodStart: r.current_period_start,
          currentPeriodEnd: r.current_period_end,
          cancelAtPeriodEnd: !!r.cancel_at_period_end,
        }
      : null,
    currentMonth: { month: String(r.current_month).slice(0, 7), used: Number(r.used_current_month), limit },
    nextMonth: { month: String(r.next_month).slice(0, 7), used: Number(r.used_next_month), limit },
    canSubmit: !!r.can_submit,
  };
}

interface EventRow {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  status: EventStatus;
  review_note: string | null;
  is_free: boolean;
  price_min: number | string | null;
  price_max: number | string | null;
  ticket_url: string | null;
  age_min: number;
  poster_path: string | null;
}

const num = (v: number | string | null) => (v === null ? null : Number(v));

export const mapEventRow = (r: EventRow): VenueEvent => ({
  id: r.id,
  title: r.title,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  status: r.status,
  reviewNote: r.review_note,
  isFree: r.is_free,
  priceMin: num(r.price_min),
  priceMax: num(r.price_max),
  ticketUrl: r.ticket_url,
  ageMin: r.age_min,
  posterPath: r.poster_path,
});

export function submissionPayload(s: EventSubmission): Record<string, unknown> {
  return {
    title: s.title.trim(),
    starts_at: s.startsAt,
    ends_at: s.endsAt ?? null,
    is_free: s.isFree,
    price_min: s.isFree ? null : (s.priceMin ?? null),
    price_max: s.isFree ? null : (s.priceMax ?? null),
    ticket_url: s.ticketUrl?.trim() || null,
    age_min: s.ageMin ?? 18,
    genre_slugs: s.genreSlugs,
    poster_path: s.posterPath ?? null,
  };
}

// --- Demo store ---------------------------------------------------------------------------------------------------------

const DEMO_ACCOUNT_ID = 'demo-casa-mare';
const CASA_MARE = { id: '8e8224e9-9e2e-3a53-888c-b2fc444c3972', slug: 'casa-mare', name: 'Casa Maré', area: 'Praia do Canto' };
const DAY = 86_400_000;

type DemoAccount = Omit<VenueAccount, 'currentMonth' | 'nextMonth' | 'canSubmit'>;
interface DemoEvent extends VenueEvent {
  accountId: string;
}

interface CasasDemoState {
  accounts: DemoAccount[];
  events: DemoEvent[];
}

/** Next Friday (SP) at 23:00 after `nowMs`, `weeks` weeks later. */
function demoFriday(nowMs: number, weeks: number): string {
  const sp = new Date(nowMs - 3 * 3_600_000);
  const toFriday = (5 - sp.getUTCDay() + 7) % 7 || 7;
  const d = new Date(Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), sp.getUTCDate() + toFriday + weeks * 7, 23 + 3));
  return d.toISOString();
}

export function initialCasasDemo(nowMs: number = Date.now()): CasasDemoState {
  const periodStart = new Date(nowMs - 5 * DAY).toISOString();
  const periodEnd = new Date(nowMs + 25 * DAY).toISOString();
  const base = { endsAt: null, reviewNote: null, isFree: false, priceMin: 30, priceMax: 60, ageMin: 18, posterPath: null, accountId: DEMO_ACCOUNT_ID };
  return {
    accounts: [
      {
        id: DEMO_ACCOUNT_ID,
        role: 'owner',
        status: 'verified',
        cnpj: '11222333000181',
        legalName: 'Casa Maré Entretenimento Ltda',
        contactName: 'Marina',
        whatsapp: '+5527999990000',
        reviewNote: null,
        createdAt: new Date(nowMs - 40 * DAY).toISOString(),
        venue: CASA_MARE,
        proposedVenue: null,
        plan: { code: PLAN.code, priceCents: PLAN.priceCents, eventsPerMonth: PLAN.eventsPerMonth },
        subscription: { status: 'active', currentPeriodStart: periodStart, currentPeriodEnd: periodEnd, cancelAtPeriodEnd: false },
      },
    ],
    events: [
      { ...base, id: 'demo-festa-1', title: 'Maré Alta: sertanejo', startsAt: demoFriday(nowMs, 0), status: 'published', ticketUrl: 'https://example.com/ingressos/mare-alta' },
      { ...base, id: 'demo-festa-2', title: 'House na Praia', startsAt: demoFriday(nowMs, 1), status: 'pending_review', ticketUrl: null },
    ],
  };
}

export const useCasasDemo = create<CasasDemoState>()(() => initialCasasDemo());

/** Test hook / Perfil demo reset. */
export function resetCasasDemo(nowMs: number = Date.now()): void {
  useCasasDemo.setState(initialCasasDemo(nowMs), true);
}

const demoUsed = (accountId: string, month: string) =>
  useCasasDemo.getState().events.filter((e) => e.accountId === accountId && countsForQuota(e.status) && partyMonthKey(e.startsAt) === month).length;

function demoView(a: DemoAccount, nowMs: number): VenueAccount {
  const cur = partyMonthKey(new Date(nowMs).toISOString());
  const next = addMonthKey(cur, 1);
  const limit = a.plan.eventsPerMonth;
  const live = !!a.subscription && (a.subscription.status === 'active' ||
    (a.subscription.status === 'past_due' && !!a.subscription.currentPeriodEnd && Date.parse(a.subscription.currentPeriodEnd) > nowMs));
  return {
    ...a,
    currentMonth: { month: cur, used: demoUsed(a.id, cur), limit },
    nextMonth: { month: next, used: demoUsed(a.id, next), limit },
    canSubmit: a.status === 'verified' && !!a.venue && live,
  };
}

const demoAccount = (id: string) => useCasasDemo.getState().accounts.find((a) => a.id === id) ?? null;

// --- API ------------------------------------------------------------------------------------------------------------------

/** The caller's casas for the panel. Throws on network/RLS errors (react-query shows the error state). */
export async function fetchMyVenueAccounts(nowMs: number = Date.now()): Promise<VenueAccount[]> {
  if (!isRemote()) return useCasasDemo.getState().accounts.map((a) => demoView(a, nowMs));
  const sb = getSupabase();
  if (!sb) return [];
  if (!(await sb.auth.getSession()).data.session) return [];
  const { data, error } = await sb.rpc('my_venue_accounts');
  if (error) throw error;
  return ((data ?? []) as AccountRow[]).map(mapAccountRow);
}

/** Every festa of the account (any status), newest first. */
export async function fetchAccountEvents(accountId: string): Promise<VenueEvent[]> {
  if (!isRemote()) {
    return useCasasDemo.getState().events
      .filter((e) => e.accountId === accountId)
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
      .map(({ accountId: _omit, ...e }) => e);
  }
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from('events')
    .select('id, title, starts_at, ends_at, status, review_note, is_free, price_min, price_max, ticket_url, age_min, poster_path')
    .eq('venue_account_id', accountId)
    .order('starts_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as EventRow[]).map(mapEventRow);
}

/** Usage of a party month (`YYYY-MM`). */
export async function fetchVenueQuota(accountId: string, month: string): Promise<QuotaUsage> {
  if (!isRemote()) {
    const a = demoAccount(accountId);
    return { month, used: demoUsed(accountId, month), limit: a?.plan.eventsPerMonth ?? PLAN.eventsPerMonth };
  }
  const sb = getSupabase();
  if (!sb) return { month, used: 0, limit: PLAN.eventsPerMonth };
  const { data, error } = await sb.rpc('venue_quota', { p_account: accountId, p_month: `${month}-01` });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as { used: number; limit: number } | undefined;
  return { month, used: Number(row?.used ?? 0), limit: Number(row?.limit ?? PLAN.eventsPerMonth) };
}

export async function claimVenue(input: ClaimVenueInput): Promise<CasasResult<{ accountId: string }>> {
  if (!isValidCnpj(input.cnpj)) return fail('invalid_cnpj');
  if (!input.venueId === !input.proposed) return fail('invalid_payload');
  if (!isRemote()) {
    const cnpj = onlyDigits(input.cnpj);
    const { accounts } = useCasasDemo.getState();
    if (accounts.some((a) => a.cnpj === cnpj && a.status !== 'rejected')) return fail('cnpj_taken');
    if (input.venueId && accounts.some((a) => a.venue?.id === input.venueId && a.status !== 'rejected')) return fail('venue_taken');
    const id = `demo-${uuid()}`;
    const account: DemoAccount = {
      id,
      role: 'owner',
      status: 'pending',
      cnpj,
      legalName: input.legalName.trim(),
      contactName: input.contactName.trim(),
      whatsapp: input.whatsapp.replace(/[^0-9+]/g, ''),
      reviewNote: null,
      createdAt: new Date().toISOString(),
      venue: null,
      proposedVenue: input.proposed,
      plan: { code: PLAN.code, priceCents: PLAN.priceCents, eventsPerMonth: PLAN.eventsPerMonth },
      subscription: null,
    };
    if (input.venueId) account.venue = input.venueId === CASA_MARE.id ? CASA_MARE : { id: input.venueId, slug: '', name: input.venueLabel?.name ?? 'Casa', area: input.venueLabel?.area ?? '' };
    useCasasDemo.setState({ accounts: [...accounts, account] });
    return { ok: true, accountId: id };
  }
  try {
    const sb = getSupabase();
    if (!sb) return fail('no_backend');
    const { data, error } = await sb.rpc('claim_venue', {
      p_venue_id: input.venueId,
      p_proposed: input.proposed,
      p_cnpj: onlyDigits(input.cnpj),
      p_legal_name: input.legalName,
      p_contact_name: input.contactName,
      p_whatsapp: input.whatsapp,
    });
    if (error) return fail(await codeOf(error));
    return { ok: true, accountId: data as string };
  } catch (e) {
    return fail(await codeOf(e));
  }
}

export async function submitEvent(accountId: string, submission: EventSubmission, nowMs: number = Date.now()): Promise<CasasResult<{ eventId: string }>> {
  if (!isRemote()) {
    const a = demoAccount(accountId);
    if (!a) return fail('not_member');
    const blocker = submissionBlocker(a, submission.startsAt, demoUsed(accountId, partyMonthKey(submission.startsAt)), nowMs);
    if (blocker) return fail(blocker);
    if (submission.title.trim().length < 3) return fail('invalid_payload');
    if (submission.ticketUrl && !/^https:\/\/[^@/\s]+(\/\S*)?$/i.test(submission.ticketUrl.trim())) return fail('invalid_ticket_url');
    if ((submission.ageMin ?? 18) < 18) return fail('invalid_age');
    if (submission.genreSlugs.length > 3) return fail('invalid_genre');
    const id = `demo-${uuid()}`;
    const p = submissionPayload(submission);
    useCasasDemo.setState((s) => ({
      events: [
        ...s.events,
        {
          id,
          accountId,
          title: p.title as string,
          startsAt: submission.startsAt,
          endsAt: submission.endsAt ?? null,
          status: 'pending_review',
          reviewNote: null,
          isFree: submission.isFree,
          priceMin: p.price_min as number | null,
          priceMax: p.price_max as number | null,
          ticketUrl: p.ticket_url as string | null,
          ageMin: p.age_min as number,
          posterPath: submission.posterPath ?? null,
        },
      ],
    }));
    return { ok: true, eventId: id };
  }
  try {
    const sb = getSupabase();
    if (!sb) return fail('no_backend');
    const { data, error } = await sb.rpc('submit_event', { p_account: accountId, p_payload: submissionPayload(submission) });
    if (error) return fail(await codeOf(error));
    return { ok: true, eventId: data as string };
  } catch (e) {
    return fail(await codeOf(e));
  }
}

/** Withdraws a festa: pending/draft -> rejected (slot back), published -> cancelled (still counts). */
export async function cancelEventSubmission(eventId: string): Promise<CasasResult<{ status: EventStatus }>> {
  if (!isRemote()) {
    const ev = useCasasDemo.getState().events.find((e) => e.id === eventId);
    if (!ev) return fail('event_not_found');
    let status: EventStatus;
    if (ev.status === 'draft' || ev.status === 'pending_review') status = 'rejected';
    else if (ev.status === 'published') status = 'cancelled';
    else return fail('not_cancellable');
    useCasasDemo.setState((s) => ({
      events: s.events.map((e) => (e.id === eventId ? { ...e, status, reviewNote: status === 'rejected' ? 'Retirada pela casa' : e.reviewNote } : e)),
    }));
    return { ok: true, status };
  }
  try {
    const sb = getSupabase();
    if (!sb) return fail('no_backend');
    const { data, error } = await sb.rpc('cancel_event_submission', { p_event_id: eventId });
    if (error) return fail(await codeOf(error));
    return { ok: true, status: data as EventStatus };
  } catch (e) {
    return fail(await codeOf(e));
  }
}

/**
 * Starts the Stripe Checkout. `url` is the page to open (expo-web-browser). In the demo there is no Stripe: the
 * subscription is activated locally and `url` is null.
 */
export async function startCheckout(accountId: string, nowMs: number = Date.now()): Promise<CasasResult<{ url: string | null }>> {
  if (!isRemote()) {
    const a = demoAccount(accountId);
    if (!a || a.role !== 'owner') return fail('not_owner');
    if (a.status === 'rejected') return fail('account_rejected');
    if (a.subscription && (a.subscription.status === 'active' || a.subscription.status === 'past_due')) return fail('already_subscribed');
    useCasasDemo.setState((s) => ({
      accounts: s.accounts.map((x) => x.id === accountId
        ? { ...x, subscription: { status: 'active', currentPeriodStart: new Date(nowMs).toISOString(), currentPeriodEnd: new Date(nowMs + 30 * DAY).toISOString(), cancelAtPeriodEnd: false } }
        : x),
    }));
    return { ok: true, url: null };
  }
  return invokeUrl('billing-checkout', accountId);
}

/** Opens the Stripe Customer Portal (card, invoices, cancel). Null `url` in the demo. */
export async function openBillingPortal(accountId: string): Promise<CasasResult<{ url: string | null }>> {
  if (!isRemote()) {
    const a = demoAccount(accountId);
    if (!a || a.role !== 'owner') return fail('not_owner');
    return a.subscription ? { ok: true, url: null } : fail('no_customer');
  }
  return invokeUrl('billing-portal', accountId);
}

async function invokeUrl(fn: 'billing-checkout' | 'billing-portal', accountId: string): Promise<CasasResult<{ url: string | null }>> {
  try {
    const sb = getSupabase();
    if (!sb) return fail('no_backend');
    const { data, error } = await sb.functions.invoke(fn, { method: 'POST', body: { venue_account_id: accountId } });
    if (error) return fail(await codeOf(error));
    const url = (data as { url?: unknown } | null)?.url;
    return typeof url === 'string' && url.startsWith('https://') ? { ok: true, url } : fail('network');
  } catch (e) {
    return fail(await codeOf(e));
  }
}

export interface PosterFile {
  uri: string;
  mimeType?: string | null;
  /** Bytes, when the picker knows it. */
  size?: number | null;
}

/** Uploads a poster to `<accountId>/<uuid>.<ext>` and returns that path (pass it as posterPath to submitEvent). */
export async function uploadPoster(accountId: string, file: PosterFile): Promise<CasasResult<{ path: string }>> {
  const mime = (file.mimeType ?? '').toLowerCase();
  const ext = POSTER_EXT[mime];
  if (!ext) return fail('poster_type');
  if (file.size != null && file.size > POSTER_MAX_BYTES) return fail('poster_too_large');
  const path = `${accountId}/${uuid()}.${ext}`;
  if (!isRemote()) return demoAccount(accountId) ? { ok: true, path } : fail('not_member');
  try {
    const sb = getSupabase();
    if (!sb) return fail('no_backend');
    const body = await (await fetch(file.uri)).arrayBuffer();
    if (body.byteLength > POSTER_MAX_BYTES) return fail('poster_too_large');
    const { error } = await sb.storage.from(POSTER_BUCKET).upload(path, body, { contentType: mime, upsert: false });
    if (error) return fail(await codeOf(error));
    return { ok: true, path };
  } catch (e) {
    return fail(await codeOf(e));
  }
}

/** Short-lived URL to show a private poster (members, or anyone once the festa is public). Null in the demo. */
export async function posterUrl(path: string, expiresInS = 3600): Promise<string | null> {
  const sb = getSupabase();
  if (!sb || !isRemote()) return null;
  const { data, error } = await sb.storage.from(POSTER_BUCKET).createSignedUrl(path, expiresInS);
  return error ? null : (data?.signedUrl ?? null);
}

// --- Hooks ------------------------------------------------------------------------------------------------------------------

/** Demo mutations change the zustand store; subscribing keeps the queries fresh. */
function useDemoVersion(): unknown {
  return useCasasDemo((s) => (isRemote() ? null : s));
}

export function useMyVenueAccounts() {
  const demo = useDemoVersion();
  return useQuery({ queryKey: [...casasKeys.accounts, demo], queryFn: () => fetchMyVenueAccounts(), staleTime: 60_000, placeholderData: keepPreviousData });
}

export function useAccountEvents(accountId: string | undefined) {
  const demo = useDemoVersion();
  return useQuery({
    queryKey: [...casasKeys.events(accountId ?? ''), demo],
    queryFn: () => fetchAccountEvents(accountId!),
    enabled: !!accountId,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useVenueQuota(accountId: string | undefined, month: string | undefined) {
  const demo = useDemoVersion();
  return useQuery({
    queryKey: [...casasKeys.quota(accountId ?? '', month ?? ''), demo],
    queryFn: () => fetchVenueQuota(accountId!, month!),
    enabled: !!accountId && !!month,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

/** Mutation that resolves with the CasasResult (never rejects) and refreshes the casa queries on success. */
function useCasasMutation<V, T>(fn: (v: V) => Promise<CasasResult<T>>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (res) => {
      if (res.ok) void qc.invalidateQueries({ queryKey: casasKeys.all });
    },
  });
}

export const useClaimVenue = () => useCasasMutation((input: ClaimVenueInput) => claimVenue(input));
export const useSubmitEvent = () =>
  useCasasMutation((v: { accountId: string; submission: EventSubmission }) => submitEvent(v.accountId, v.submission));
export const useCancelEventSubmission = () => useCasasMutation((eventId: string) => cancelEventSubmission(eventId));
export const useStartCheckout = () => useCasasMutation((accountId: string) => startCheckout(accountId));
export const useOpenBillingPortal = () => useCasasMutation((accountId: string) => openBillingPortal(accountId));
export const useUploadPoster = () =>
  useMutation({ mutationFn: (v: { accountId: string; file: PosterFile }) => uploadPoster(v.accountId, v.file) });

// Back-office /admin data layer (migration 0024). Every admin_* RPC checks server-side that the caller is on the team
// (staff_members), so this screen is a convenience, never the guard. Calls return an AdminResult and never throw.
// There is no demo: without Supabase the screen says the panel needs the backend.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  adminErrorMessage,
  isAdminErrorCode,
  mapAction,
  mapHiddenPost,
  mapIngestCandidate,
  mapOverview,
  mapPendingAccount,
  mapPendingEvent,
  mapSafetyItem,
  mapSafetyReport,
  type AdminAction,
  type AdminErrorCode,
  type AdminOverview,
  type HiddenPost,
  type IngestCandidate,
  type PendingAccount,
  type PendingEvent,
  type SafetyQueueItem,
  type SafetyReportItem,
} from '@/domain/admin';

import { posterUrl } from './casas';
import { getSupabase, isRemote } from './supabaseClient';

export type AdminResult<T> = { ok: true; data: T } | { ok: false; code: AdminErrorCode; error: string };

const fail = (code: AdminErrorCode): { ok: false; code: AdminErrorCode; error: string } => ({
  ok: false,
  code,
  error: adminErrorMessage(code),
});

/** Server error -> code: the RPCs raise the code as the message (venue_error). */
function codeOf(err: unknown): AdminErrorCode {
  if (!err || typeof err !== 'object') return 'network';
  const e = err as { message?: unknown; hint?: unknown };
  if (isAdminErrorCode(e.message)) return e.message;
  if (isAdminErrorCode(e.hint)) return e.hint;
  if (typeof e.message === 'string' && /permission denied|JWT/i.test(e.message)) return 'not_authenticated';
  return 'network';
}

async function rpc<T>(fn: string, args: Record<string, unknown> | undefined, map: (data: unknown) => T): Promise<AdminResult<T>> {
  const sb = getSupabase();
  if (!sb || !isRemote()) return fail('no_backend');
  try {
    const { data, error } = await sb.rpc(fn, args);
    if (error) return fail(codeOf(error));
    return { ok: true, data: map(data) };
  } catch (e) {
    return fail(codeOf(e));
  }
}

const rows = (data: unknown): Record<string, unknown>[] => (Array.isArray(data) ? (data as Record<string, unknown>[]) : []);
const scalar = (data: unknown): string => (typeof data === 'string' ? data : String(data ?? ''));

// --- Reads ------------------------------------------------------------------------------------------------------------

/** Whether the signed-in user is on the team. False without a backend or a session. */
export async function fetchIsStaff(): Promise<boolean> {
  const r = await rpc('is_staff', undefined, (d) => d === true);
  return r.ok && r.data;
}

export const fetchOverview = () => rpc<AdminOverview>('admin_overview', undefined, (d) => mapOverview(rows(d)[0]));
export const fetchPendingEvents = () => rpc<PendingEvent[]>('admin_pending_events', undefined, (d) => rows(d).map(mapPendingEvent));
export const fetchPendingAccounts = () => rpc<PendingAccount[]>('admin_pending_accounts', undefined, (d) => rows(d).map(mapPendingAccount));
export const fetchSafetyQueue = () => rpc<SafetyQueueItem[]>('admin_safety_queue', undefined, (d) => rows(d).map(mapSafetyItem));
export const fetchHiddenPosts = () => rpc<HiddenPost[]>('admin_hidden_posts', undefined, (d) => rows(d).map(mapHiddenPost));
export const fetchSafetyReports = () => rpc<SafetyReportItem[]>('admin_safety_reports', undefined, (d) => rows(d).map(mapSafetyReport));
export const fetchIngestQueue = () => rpc<IngestCandidate[]>('admin_ingest_queue', undefined, (d) => rows(d).map(mapIngestCandidate));
export const fetchRecentActions = (limit = 50) =>
  rpc<AdminAction[]>('admin_recent_actions', { p_limit: limit }, (d) => rows(d).map(mapAction));

/** Festa posters and seal photos sit in the private bucket; staff may read them (0024 storage policy). */
export const adminImageUrl = (path: string) => posterUrl(path, 600);

// --- Decisions --------------------------------------------------------------------------------------------------------

const noteArg = (note?: string | null) => (note && note.trim() ? note.trim() : null);

export const reviewEvent = (eventId: string, approve: boolean, note?: string | null) =>
  rpc('admin_review_event', { p_event_id: eventId, p_approve: approve, p_note: noteArg(note) }, scalar);

export const verifyEvent = (eventId: string) => rpc('admin_verify_event', { p_event_id: eventId }, scalar);

export const reviewAccount = (accountId: string, approve: boolean, note?: string | null, venueId?: string | null) =>
  rpc('admin_review_account', { p_account: accountId, p_approve: approve, p_note: noteArg(note), p_venue_id: venueId ?? null }, scalar);

export type SealDecision = 'verify' | 'reject' | 'contest';
export const reviewSafety = (venueId: string, decision: SealDecision, note?: string | null) =>
  rpc('admin_review_safety', { p_venue_id: venueId, p_decision: decision, p_note: noteArg(note) }, (d) => (d == null ? null : scalar(d)));

export type ModerationAction = 'restore' | 'keep_hidden';
export const moderatePost = (kind: HiddenPost['kind'], id: string, action: ModerationAction, note?: string | null) =>
  rpc('admin_moderate', { p_kind: kind, p_id: id, p_action: action, p_note: noteArg(note) }, scalar);

export const reviewIngest = (id: string, approve: boolean, note?: string | null) =>
  rpc('admin_review_ingest', { p_id: id, p_approve: approve, p_note: noteArg(note) }, scalar);

export const replyTicket = (ticketId: string, text: string, close = false) =>
  rpc('admin_reply_ticket', { p_ticket_id: ticketId, p_text: text.trim(), p_close: close }, scalar);

// --- Hooks ------------------------------------------------------------------------------------------------------------

export const adminKeys = {
  all: ['admin'] as const,
  staff: ['admin', 'staff'] as const,
  overview: ['admin', 'overview'] as const,
  events: ['admin', 'events'] as const,
  accounts: ['admin', 'accounts'] as const,
  safety: ['admin', 'safety'] as const,
  posts: ['admin', 'posts'] as const,
  reports: ['admin', 'reports'] as const,
  ingest: ['admin', 'ingest'] as const,
  log: ['admin', 'log'] as const,
};

/** Unwraps an AdminResult so React Query sees failures as errors (with the pt-BR message). */
async function unwrap<T>(p: Promise<AdminResult<T>>): Promise<T> {
  const r = await p;
  if (!r.ok) throw Object.assign(new Error(r.error), { code: r.code });
  return r.data;
}

/** `userKey` (the signed-in email) refetches when the person signs in or out. */
export function useIsStaff(userKey: string | null) {
  return useQuery({ queryKey: [...adminKeys.staff, userKey], queryFn: fetchIsStaff, enabled: !!userKey, staleTime: 5 * 60_000 });
}

const q = <T>(key: readonly unknown[], fn: () => Promise<AdminResult<T>>, enabled: boolean) => ({
  queryKey: key,
  queryFn: () => unwrap(fn()),
  enabled,
  staleTime: 15_000,
});

export const useAdminOverview = (enabled: boolean) => useQuery(q(adminKeys.overview, fetchOverview, enabled));
export const usePendingEvents = (enabled: boolean) => useQuery(q(adminKeys.events, fetchPendingEvents, enabled));
export const usePendingAccounts = (enabled: boolean) => useQuery(q(adminKeys.accounts, fetchPendingAccounts, enabled));
export const useSafetyQueue = (enabled: boolean) => useQuery(q(adminKeys.safety, fetchSafetyQueue, enabled));
export const useHiddenPosts = (enabled: boolean) => useQuery(q(adminKeys.posts, fetchHiddenPosts, enabled));
export const useSafetyReports = (enabled: boolean) => useQuery(q(adminKeys.reports, fetchSafetyReports, enabled));
export const useIngestQueue = (enabled: boolean) => useQuery(q(adminKeys.ingest, fetchIngestQueue, enabled));
export const useRecentActions = (enabled: boolean) => useQuery(q(adminKeys.log, () => fetchRecentActions(), enabled));

/** Any decision refreshes every queue, the counters and the log. */
export function useAdminMutation<V, T>(fn: (v: V) => Promise<AdminResult<T>>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (res) => {
      if (res.ok) void qc.invalidateQueries({ queryKey: adminKeys.all });
    },
  });
}

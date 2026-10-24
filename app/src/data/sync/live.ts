import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { CrowdLevel, LiveReport, MusicLevel, QueueLevel } from '@/domain/engage';
import { useNow } from '@/features/acompanhar/useNow';
import { summarize, type LiveSummary } from '@/features/aoVivo/logic';
import { useLive } from '@/state/live';

import { isRemote } from '../supabaseClient';
import { authedClient, isRejection, safely, warn, whenHydrated, type PushResult } from './util';

/** Reports can only be inserted within 6h of the check-in; older local ones are not worth sending. */
export const REPORT_PUSH_WINDOW_MS = 6 * 3600_000;
export const isLocalId = (id: string) => id.startsWith('local-');

const setUnsynced = (id: string, on: boolean) =>
  useLive.setState((s) => {
    const has = s.unsynced.includes(id);
    return on === has ? s : { unsynced: on ? [...s.unsynced, id] : s.unsynced.filter((x) => x !== id) };
  });

export const toRow = (r: LiveReport) => ({
  event_id: r.eventId,
  queue: r.queue ?? null,
  crowd: r.crowd ?? null,
  music: r.music ?? null,
  price_at_door: r.priceAtDoor ?? null,
});

/**
 * Inserts a report. Check-in (6h) and the 1-report/10min throttle are enforced by RLS/trigger: a rejection keeps
 * the local report, marks it unsynced and is not retried. On success the local id is swapped for the server id.
 */
export function pushReport(r: LiveReport): Promise<PushResult> {
  return safely('report', async (sb) => {
    const { data, error } = await sb.from('event_reports').insert(toRow(r)).select('id').single();
    if (error) {
      if (isRejection(error)) {
        setUnsynced(r.id, true);
        return 'rejected';
      }
      throw error;
    }
    const serverId = (data as { id?: string } | null)?.id;
    useLive.setState((s) => ({
      reports: serverId ? s.reports.map((x) => (x.id === r.id ? { ...x, id: serverId } : x)) : s.reports,
      unsynced: s.unsynced.filter((x) => x !== r.id),
    }));
    return 'synced';
  });
}

/**
 * Community reports are not merged into the store (user_id is hidden, so "mine" is unknowable); the screen reads
 * the server summary instead. Pull only uploads local reports that never reached the server.
 */
export async function pullLive(nowMs = Date.now()): Promise<void> {
  try {
    if (!(await authedClient())) return;
    await whenHydrated(useLive);
    const { reports, unsynced } = useLive.getState();
    const pending = reports.filter((r) => isLocalId(r.id) && !unsynced.includes(r.id));
    const stale = pending.filter((r) => nowMs - Date.parse(r.at) > REPORT_PUSH_WINDOW_MS);
    if (stale.length) useLive.setState((s) => ({ unsynced: [...s.unsynced, ...stale.map((r) => r.id)] }));
    await Promise.all(pending.filter((r) => !stale.includes(r)).map(pushReport));
  } catch (e) {
    warn('pullLive', e);
  }
}

// --- Summary (event_live_summary RPC) ---

export interface SummaryRow {
  queue: QueueLevel | null;
  crowd: CrowdLevel | null;
  music: MusicLevel | null;
  price_at_door: number | string | null;
  sample_size: number | null;
  last_report_at: string | null;
}

/** Maps the RPC row (fresh-window aggregates computed server side) to the screen's LiveSummary. */
export function mapSummaryRow(row: SummaryRow | undefined): LiveSummary {
  const n = row?.sample_size ?? 0;
  const at = row?.last_report_at ?? undefined;
  const metric = <T,>(value: T | null | undefined) => (value != null && at ? { value, at, n, stale: n === 0 } : undefined);
  const price = row?.price_at_door == null ? null : Number(row.price_at_door);
  return {
    queue: metric(row?.queue),
    crowd: metric(row?.crowd),
    music: metric(row?.music),
    price: metric(price),
    freshCount: n,
    lastAt: at,
    allStale: n === 0,
  };
}

export async function fetchLiveSummary(eventId: string): Promise<LiveSummary | null> {
  const sb = await authedClient();
  if (!sb) return null;
  const { data, error } = await sb.rpc('event_live_summary', { p_event_id: eventId });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as SummaryRow | undefined;
  return mapSummaryRow(row);
}

export const liveSummaryKey = (eventId: string) => ['live-summary', eventId] as const;

/** Server summary when remote (refreshed every minute); the device's own reports otherwise or when the call fails. */
export function useLiveSummary(eventId: string | undefined) {
  const reports = useLive((s) => s.reports);
  const remote = isRemote();
  const q = useQuery({
    queryKey: liveSummaryKey(eventId ?? ''),
    queryFn: () => fetchLiveSummary(eventId!),
    enabled: remote && !!eventId,
    refetchInterval: 60_000,
    retry: false,
  });
  const nowMs = useNow(60_000);
  const local = useMemo(() => summarize(reports.filter((r) => r.eventId === eventId), nowMs), [reports, eventId, nowMs]);
  return {
    data: (remote ? q.data : null) ?? local,
    isLoading: remote && q.isPending && q.fetchStatus !== 'idle',
    fromServer: !!q.data,
    refetch: q.refetch,
  };
}

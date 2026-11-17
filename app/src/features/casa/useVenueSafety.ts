import { useQuery } from '@tanstack/react-query';

import { getSupabase, isRemote } from '@/data/supabaseClient';
import { computeSafetyStats, EMPTY_SAFETY_STATS, type VenueSafetyStats } from '@/domain/safetyIndex';
import { DEMO_REVIEWS, DEMO_VENUE_SLUG } from '@/features/avaliacoes/demo';

interface StatsRow {
  sample_size: number | null;
  safety_avg: number | string | null;
  felt_safe_n: number | null;
  felt_safe_share: number | string | null;
}

const num = (v: number | string | null | undefined) => (v == null ? null : Number(v));

export function mapSafetyStats(r: StatsRow | undefined | null): VenueSafetyStats {
  if (!r) return EMPTY_SAFETY_STATS;
  return {
    sampleSize: Number(r.sample_size ?? 0),
    average: num(r.safety_avg),
    feltSafeN: Number(r.felt_safe_n ?? 0),
    feltSafeShare: num(r.felt_safe_share),
  };
}

/** Índice de segurança of a venue (S2). Offline/demo: only Casa Maré has (demonstration) reviews. Throws on errors. */
export async function fetchVenueSafety(venue: { id: string; slug: string }, nowMs: number = Date.now()): Promise<VenueSafetyStats> {
  if (!isRemote()) {
    if (venue.slug !== DEMO_VENUE_SLUG) return EMPTY_SAFETY_STATS;
    // Demo reviews are not tied to a real event: their date stands in for the event start.
    const at = new Map(DEMO_REVIEWS.map((r) => [r.id, r.createdAt]));
    return computeSafetyStats(DEMO_REVIEWS.map((r) => ({ ...r, eventId: r.id })), (id) => at.get(id), nowMs);
  }
  const sb = getSupabase();
  if (!sb) return EMPTY_SAFETY_STATS;
  const { data, error } = await sb.rpc('venue_safety_stats', { p_venue_id: venue.id });
  if (error) throw error;
  return mapSafetyStats((Array.isArray(data) ? data[0] : data) as StatsRow | undefined);
}

export const useVenueSafety = (venue: { id: string; slug: string } | undefined) =>
  useQuery({
    queryKey: ['venue-safety', venue?.id ?? ''],
    queryFn: () => fetchVenueSafety(venue!),
    enabled: !!venue,
    staleTime: 5 * 60_000,
  });

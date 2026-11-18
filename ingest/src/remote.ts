// Curator decisions from /admin (migration 0025): the run pushes the records waiting for approval to
// public.ingest_candidates and reads back which ones staff approved or rejected. Optional: without SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY the pipeline works exactly as before (approved.json only). A failure here never fails the
// run; it is reported under `skipped`.

import type { Candidate } from './normalize.js';

export interface RemoteConfig {
  url: string;
  serviceKey: string;
}

export type RemoteFetch = (
  url: string,
  init: { method: 'GET' | 'POST'; headers: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown>; text(): Promise<string> }>;

export interface Decisions {
  approved: Set<string>;
  rejected: Set<string>;
}

export interface RemoteReview {
  decisions(): Promise<Decisions>;
  push(pending: Candidate[], now: Date): Promise<number>;
}

/** Reads the service credentials from the environment; null when either is missing. */
export function remoteConfigFromEnv(env: Record<string, string | undefined> = process.env): RemoteConfig | null {
  const url = env.SUPABASE_URL?.trim().replace(/\/+$/, '');
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey || !/^https:\/\//.test(url)) return null;
  return { url, serviceKey };
}

const HTTPS = /^https:\/\/[^@/\s]+(\/\S*)?$/i;

/** Row for public.ingest_candidates. Never carries status: the decision belongs to staff. */
export function candidateRow(c: Candidate, now: Date) {
  const e = c.event;
  const url = c.sources.find((s) => HTTPS.test(s.url))?.url ?? null;
  const price = e.isFree ? 'Grátis' : e.priceMin == null ? null : e.priceMax != null && e.priceMax !== e.priceMin ? `R$ ${e.priceMin} a R$ ${e.priceMax}` : `R$ ${e.priceMin}`;
  return {
    key: c.key,
    tier: c.tier,
    title: e.title.slice(0, 200),
    starts_at: e.startsAt,
    venue_name: (c.venue.name || 'Casa sem nome').slice(0, 200),
    venue_matched: c.venueMatched,
    source_url: url && url.length <= 500 ? url : null,
    flags: c.flags,
    details: {
      ...(price && { price }),
      ...(c.artists.length && { artists: c.artists.map((a) => a.name).slice(0, 12) }),
      ...(e.genreSlugs.length && { genres: e.genreSlugs }),
      ...(c.venue.address && { address: c.venue.address }),
      sources: c.sources.map((s) => s.source),
    },
    last_seen_at: now.toISOString(),
  };
}

export function createRemoteReview(cfg: RemoteConfig, fetchImpl: RemoteFetch = globalThis.fetch as unknown as RemoteFetch): RemoteReview {
  const headers = {
    apikey: cfg.serviceKey,
    authorization: `Bearer ${cfg.serviceKey}`,
    'content-type': 'application/json',
  };
  const base = `${cfg.url}/rest/v1/ingest_candidates`;
  return {
    async decisions() {
      const res = await fetchImpl(`${base}?select=key,status&status=in.(approved,rejected)`, { method: 'GET', headers });
      if (!res.ok) throw new Error(`ingest_candidates read failed: HTTP ${res.status}`);
      const rows = (await res.json()) as { key?: unknown; status?: unknown }[];
      const out: Decisions = { approved: new Set(), rejected: new Set() };
      for (const r of Array.isArray(rows) ? rows : []) {
        if (typeof r.key !== 'string') continue;
        if (r.status === 'approved') out.approved.add(r.key);
        else if (r.status === 'rejected') out.rejected.add(r.key);
      }
      return out;
    },
    async push(pending, now) {
      if (pending.length === 0) return 0;
      const body = JSON.stringify(pending.map((c) => candidateRow(c, now)));
      const res = await fetchImpl(`${base}?on_conflict=key`, {
        method: 'POST',
        headers: { ...headers, prefer: 'resolution=merge-duplicates,return=minimal' },
        body,
      });
      if (!res.ok) throw new Error(`ingest_candidates upsert failed: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
      return pending.length;
    },
  };
}

/** Side information an adapter reports besides its RawEvents (shown in candidates.json). */
export interface NeedsReview {
  source: string;
  /** Page url or file name + row. */
  ref: string;
  reason: string;
  /** Whatever could be read, for the human reviewer. Never published. */
  partial?: Record<string, unknown>;
}

export interface AdapterReport {
  needsReview: NeedsReview[];
  /** Source urls whose page disappeared (404/410): their events become cancelled. */
  gone: string[];
  /** Urls not fetched (robots.txt disallow, 403/429 stop, network error). */
  skipped: { ref: string; reason: string }[];
  stats: Record<string, number>;
}

export const emptyReport = (): AdapterReport => ({ needsReview: [], gone: [], skipped: [], stats: {} });

// Contracts of the ingestion pipeline (Wave 7). Adapters produce RawEvent; the normalizer turns them into
// the app's SeedDataset shape (app/src/domain/types.ts) written to app/public/feed/v1/events.json.

/** 1 = partner/official (auto-approve), 2 = public page metadata (human review), 3 = crawler (off by default). */
export type SourceTier = 1 | 2 | 3;

export type RawStatus = 'scheduled' | 'cancelled' | 'soldout';

export interface RawEvent {
  /** Adapter id, e.g. 'manual', 'link', 'sympla-api', 'crawler:sympla'. */
  source: string;
  /** Stable id inside the source (the platform's event id, or a hash of the url). */
  sourceId: string;
  /** Public page of the event; becomes `ticketUrl` (https only). */
  url: string;
  title: string;
  /** ISO 8601 with offset (e.g. 2026-11-07T23:00:00-03:00); normalized to UTC later. */
  startsAt: string;
  endsAt?: string;
  venueName: string;
  venueAddress?: string;
  /** BRL reais. */
  priceMin?: number;
  priceMax?: number;
  isFree?: boolean;
  ageMin?: number;
  /** Used only for genre/lineup classification; never published. */
  description?: string;
  /** Only when partner-supplied with permission. Never hotlink third-party posters. */
  imageUrl?: string;
  /** Artist names, only when explicitly listed by the source. */
  lineup?: string[];
  status?: RawStatus;
  fetchedAt: string;
}

export interface FetchContext {
  now: Date;
  /** Polite identification sent with every request. */
  userAgent: string;
  /** Root of ingest/ (data files, cache). */
  dataDir: string;
  log: (msg: string) => void;
}

export interface SourceAdapter {
  id: string;
  tier: SourceTier;
  /** False for adapters that are switched off (e.g. the crawler without INGEST_CRAWL=1). */
  enabled: () => boolean;
  fetch: (ctx: FetchContext) => Promise<RawEvent[]>;
}

export const USER_AGENT = 'QualABoaBot/1.0 (+https://qual-a-boa-lime.vercel.app/contato)';

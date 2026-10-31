// Comunidade: event-scoped threads and comments. Local-first like engage.ts (persisted zustand store
// src/state/community.ts); Supabase migration 0010 mirrors these shapes.
// Dates are ISO 8601 UTC. eventId references EventItem.id, venueSlug references Venue.slug.

import { DEFAULT_UF, type Uf } from './region';

export type ThreadKind = 'vale_a_pena' | 'grupo' | 'agora';

export const THREAD_KINDS: readonly ThreadKind[] = ['vale_a_pena', 'grupo', 'agora'];

export const KIND_LABEL: Record<ThreadKind, string> = {
  vale_a_pena: 'Vale a pena?',
  grupo: 'Rolê em grupo',
  agora: 'Agora',
};

export type CommunitySort = 'helpful' | 'recent';

/** A comment earns the "Mais útil" badge only from this many helpful votes (avoids false authority). */
export const TOP_HELPFUL_MIN = 3;

/** Max nesting: top-level comment (0) and one reply level (1) on mobile. */
export const MAX_COMMENT_DEPTH = 1;

export interface Author {
  /** Lowercase @handle without the @. Absent when the post is anonymous. */
  handle?: string;
  avatarHue?: number;
  anonymous: boolean;
}

export interface Comment {
  id: string;
  threadId: string;
  parentId?: string;
  author: Author;
  body: string;
  createdAt: string;
  helpfulCount: number;
  mine?: boolean;
}

export interface Thread {
  id: string;
  eventId?: string;
  /** Venue slug; threads also surface on every event of that venue (used by the pilot demo threads). */
  venueSlug?: string;
  /** Denormalised event or venue name for feed cards. */
  eventName: string;
  /** State (UF) of the venue. Absent on old local data and demo content, which read as the default state. */
  uf?: Uf;
  /** Mine = written on this device. */
  mine?: boolean;
  kind: ThreadKind;
  title: string;
  body?: string;
  author: Author;
  createdAt: string;
  commentCount: number;
  helpfulCount: number;
}

export const HANDLE_RE = /^[a-z0-9_.]{3,20}$/;

export function isValidHandle(h: string): boolean {
  return HANDLE_RE.test(h);
}

/** Helpful count including the viewer's own optimistic vote. */
export function effectiveHelpful(c: { id: string; helpfulCount: number }, votedIds: readonly string[]): number {
  return c.helpfulCount + (votedIds.includes(c.id) ? 1 : 0);
}

/** The pinned "Mais útil" comment: highest helpful count at or above the threshold; ties go to the newest. */
export function topHelpful<T extends { id: string; helpfulCount: number; createdAt: string }>(
  comments: readonly T[],
  votedIds: readonly string[] = [],
): T | undefined {
  let best: T | undefined;
  let bestVotes = 0;
  for (const c of comments) {
    const v = effectiveHelpful(c, votedIds);
    if (v < TOP_HELPFUL_MIN) continue;
    if (!best || v > bestVotes || (v === bestVotes && c.createdAt > best.createdAt)) {
      best = c;
      bestVotes = v;
    }
  }
  return best;
}

export function sortComments<T extends { id: string; helpfulCount: number; createdAt: string }>(
  comments: readonly T[],
  sort: CommunitySort,
  votedIds: readonly string[] = [],
): T[] {
  const copy = [...comments];
  if (sort === 'recent') return copy.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return copy.sort(
    (a, b) =>
      effectiveHelpful(b, votedIds) - effectiveHelpful(a, votedIds) || (a.createdAt < b.createdAt ? 1 : -1),
  );
}

/** `agora` threads default to newest first; the others to most helpful. */
export function defaultSort(kind: ThreadKind): CommunitySort {
  return kind === 'agora' ? 'recent' : 'helpful';
}

export const TITLE_MAX = 120;
export const THREAD_BODY_MAX = 800;
export const COMMENT_MAX = 500;

const PERSONAL_DATA = [/[\w.+-]+@[\w-]+\.[\w.]+/, /(\d[\s().-]*){9,}/];

/** pt-BR error message when the text should not be published, else undefined. Empty required text is an error. */
export function validatePost(text: string, opts: { max: number; required?: boolean; what: string }): string | undefined {
  const t = text.trim();
  if (opts.required && t.length === 0) return `Escreva ${opts.what}.`;
  if (t.length > opts.max) return `O texto passou de ${opts.max} caracteres.`;
  if (PERSONAL_DATA.some((re) => re.test(t))) return 'Retire e-mails e telefones do texto. Evite dados pessoais de terceiros.';
  return undefined;
}

// --- Feed paging -----------------------------------------------------------------------------------------------

/**
 * Threads per request, for the Comunidade feed and the event page.
 * Not measured (the app has no analytics): a reasoned default, change it here and nowhere else.
 *  - A thread card is ~110-180px, so a phone shows 4-6 and 20 rows is ~3-4 screens of scrolling; the next page is
 *    requested at 60% of the list, long before the end, so scrolling never stops.
 *  - Same page size as Explorar (`search_events` default and RECOMMENDED_PAGE), so one number to reason about.
 *  - Each row costs a comment count and a lateral join in `threads_feed`, so bigger pages (Busca uses 30) make the
 *    first response slower for little gain.
 */
export const COMMUNITY_PAGE_SIZE = 20;

/** "Seguindo" sends the followed event ids in one request; more than this are ignored (oldest follows first). */
export const MAX_FOLLOWED_IN_QUERY = 100;

export type ThreadScope = 'all' | 'tonight' | 'following';

export interface ThreadQuery {
  scope: ThreadScope;
  sort: CommunitySort;
  kind?: ThreadKind;
  /** Only conversations of this state (the Comunidade feed). Not used by an event's own page. */
  uf?: string;
  /** Only this event's threads (event page). */
  eventId?: string;
  /** Local/demo mode only: also match threads pinned to this venue. */
  venueSlug?: string;
  /** Event page keeps `agora` threads of an ended event (history); the feed hides them. */
  includeArchived?: boolean;
  /** Needed for scope 'following'. */
  followedEventIds?: string[];
}

export interface ThreadPage<T> {
  items: T[];
  /** Opaque: keyset `created_at|id` for recency, an offset for the helpful sort. Null on the last page. */
  nextCursor: string | null;
}

export interface Keyset {
  createdAt: string;
  id: string;
}

export const encodeKeyset = (k: Keyset): string => `${k.createdAt}|${k.id}`;

export function decodeKeyset(cursor: string | null | undefined): Keyset | null {
  if (!cursor) return null;
  const i = cursor.indexOf('|');
  if (i <= 0 || i === cursor.length - 1) return null;
  return { createdAt: cursor.slice(0, i), id: cursor.slice(i + 1) };
}

/** Offset cursor (helpful sort). Anything that is not a non-negative integer reads as 0. */
export function decodeOffset(cursor: string | null | undefined): number {
  const n = cursor ? Number.parseInt(cursor, 10) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Stable cache key for a query (cursor excluded), so equal queries share one cache entry. */
export function threadQueryKey(q: ThreadQuery): (string | number)[] {
  return [
    q.uf ?? '',
    q.eventId ?? 'all',
    q.kind ?? '',
    q.scope,
    q.sort,
    q.includeArchived ? 1 : 0,
    [...(q.followedEventIds ?? [])].sort().join(','),
  ];
}

interface Filterable {
  uf?: string;
  eventId?: string;
  venueSlug?: string;
  kind: ThreadKind;
  archived?: boolean;
}

/** Same filters the server applies in `pullThreadsPage`, for local/demo mode. */
export function threadMatchesQuery(t: Filterable, q: ThreadQuery): boolean {
  if (q.uf && (t.uf ?? DEFAULT_UF) !== q.uf) return false;
  if (!q.includeArchived && t.archived) return false;
  if (q.kind && t.kind !== q.kind) return false;
  if (q.scope === 'tonight' && t.kind !== 'agora') return false;
  if (q.scope === 'following' && !(t.eventId && (q.followedEventIds ?? []).includes(t.eventId))) return false;
  if (q.eventId) {
    const own = t.eventId === q.eventId;
    const pinned = !!q.venueSlug && t.venueSlug === q.venueSlug && !t.eventId;
    if (!own && !pinned) return false;
  }
  return true;
}

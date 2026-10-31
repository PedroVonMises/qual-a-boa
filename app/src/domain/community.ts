// Comunidade: event-scoped threads and comments. Local-first like engage.ts (persisted zustand store
// src/state/community.ts); Supabase migration 0010 mirrors these shapes.
// Dates are ISO 8601 UTC. eventId references EventItem.id, venueSlug references Venue.slug.

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

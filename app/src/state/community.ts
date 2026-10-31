import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { safeMerge } from './safeMerge';

import { isRemote } from '@/data/supabaseClient';
import { DEFAULT_UF, type Uf } from '@/domain/region';
import { isServerId, pushComment, pushCommentVote, pushCommunityReport, pushHandle, pushThread } from '@/data/sync/community';

import {
  COMMENT_MAX,
  isValidHandle,
  THREAD_BODY_MAX,
  TITLE_MAX,
  validatePost,
  type Comment,
  type Thread,
  type ThreadKind,
} from '@/domain/community';

// Local-first: threads and comments written on this device, plus the viewer's votes and reports.
// With the Supabase backend on, writes are pushed in the background (flushCommunity): local ids (`th-`, `cm-`)
// become server uuids once accepted; a rejected post stays on this device. Nothing is retried in a loop.

export interface ThreadInput {
  /** State of the event's venue; defaults to the default state. */
  uf?: Uf;
  eventId: string;
  eventName: string;
  venueSlug?: string;
  kind: ThreadKind;
  title: string;
  body?: string;
  anonymous: boolean;
}

export interface CommentInput {
  threadId: string;
  parentId?: string;
  body: string;
  anonymous: boolean;
}

interface CommunityStore {
  handle?: string;
  avatarHue: number;
  threads: Thread[];
  comments: Comment[];
  votedIds: string[];
  reportedIds: string[];
  /** Report ids the server accepted ('Denúncia enviada'); the rest are only saved on this device. */
  reportSentIds: string[];
  /** Local thread id -> server id once synced, so a screen opened on the local id keeps resolving its thread. */
  aliases: Record<string, string>;
  /** The handle chosen offline turned out to belong to someone else: the user must pick another to publish named posts. */
  handleTaken: boolean;
  /** Bumped after each accepted push so remote queries refetch. Not persisted. */
  tick: number;
  /** Local-only: validates and stores the handle. Returns a pt-BR error, or undefined on success. */
  setHandle: (handle: string) => string | undefined;
  /** Validates, claims the handle on the server when remote ('taken' -> error), then stores it. */
  claimHandle: (handle: string) => Promise<string | undefined>;
  /** Returns the new thread, or a pt-BR error string. */
  createThread: (input: ThreadInput) => Thread | string;
  addComment: (input: CommentInput) => Comment | string;
  toggleHelpful: (id: string) => void;
  report: (id: string, kind: 'thread' | 'comment') => void;
  /** Adds server-confirmed votes to the local set (never removes: a local vote may not be pushed yet). */
  adoptVotes: (ids: string[]) => void;
}

let seq = 0;
const newId = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export const useCommunity = create<CommunityStore>()(
  persist(
    (set, get) => ({
      handle: undefined,
      avatarHue: Math.floor(Math.random() * 360),
      threads: [],
      comments: [],
      votedIds: [],
      reportedIds: [],
      reportSentIds: [],
      aliases: {},
      handleTaken: false,
      tick: 0,
      setHandle: (handle) => {
        const h = handle.trim().toLowerCase().replace(/^@/, '');
        if (!isValidHandle(h)) return 'Use de 3 a 20 letras minúsculas, números, _ ou ponto.';
        set({ handle: h, handleTaken: false });
        return undefined;
      },
      claimHandle: async (raw) => {
        const h = raw.trim().toLowerCase().replace(/^@/, '');
        if (!isValidHandle(h)) return 'Use de 3 a 20 letras minúsculas, números, _ ou ponto.';
        if (isRemote() && (await pushHandle({ handle: h, avatarHue: get().avatarHue })) === 'taken') {
          return 'Esse @ já está em uso. Escolha outro.';
        }
        // Offline or signed out: keep it locally; posting claims it again.
        return get().setHandle(h);
      },
      createThread: (input) => {
        const { handle, avatarHue } = get();
        if (!input.anonymous && !handle) return 'Escolha seu @ para postar com nome.';
        const title = input.title.trim();
        const body = input.body?.trim();
        const err =
          validatePost(title, { max: TITLE_MAX, required: true, what: 'um título' }) ??
          validatePost(body ?? '', { max: THREAD_BODY_MAX, what: 'os detalhes' });
        if (err) return err;
        const thread: Thread = {
          id: newId('th'),
          uf: input.uf ?? DEFAULT_UF,
          eventId: input.eventId,
          eventName: input.eventName,
          venueSlug: input.venueSlug,
          kind: input.kind,
          title,
          body: body || undefined,
          author: input.anonymous ? { anonymous: true } : { anonymous: false, handle, avatarHue },
          createdAt: new Date().toISOString(),
          commentCount: 0,
          helpfulCount: 0,
          mine: true,
        };
        set((s) => ({ threads: [thread, ...s.threads] }));
        void flushCommunity();
        return thread;
      },
      addComment: (input) => {
        const { handle, avatarHue } = get();
        if (!input.anonymous && !handle) return 'Escolha seu @ para responder com nome.';
        const body = input.body.trim();
        const err = validatePost(body, { max: COMMENT_MAX, required: true, what: 'sua resposta' });
        if (err) return err;
        const comment: Comment = {
          id: newId('cm'),
          threadId: input.threadId,
          parentId: input.parentId,
          author: input.anonymous ? { anonymous: true } : { anonymous: false, handle, avatarHue },
          body,
          createdAt: new Date().toISOString(),
          helpfulCount: 0,
          mine: true,
        };
        set((s) => ({ comments: [...s.comments, comment] }));
        void flushCommunity();
        return comment;
      },
      toggleHelpful: (id) => {
        const on = !get().votedIds.includes(id);
        set((s) => ({ votedIds: on ? [...s.votedIds, id] : s.votedIds.filter((x) => x !== id) }));
        if (isRemote() && isServerId(id)) void pushCommentVote(id, on);
      },
      report: (id, kind) => {
        if (get().reportedIds.includes(id)) return;
        set((s) => ({ reportedIds: [...s.reportedIds, id] }));
        if (!isRemote()) return;
        const target = kind === 'thread' ? { threadId: id } : { commentId: id };
        void pushCommunityReport(target).then((ok) => {
          if (ok) set((s) => (s.reportSentIds.includes(id) ? s : { reportSentIds: [...s.reportSentIds, id] }));
        });
      },
      adoptVotes: (ids) =>
        set((s) => {
          const add = ids.filter((id) => !s.votedIds.includes(id));
          return add.length ? { votedIds: [...s.votedIds, ...add] } : s;
        }),
    }),
    {
      name: 'qab.community',
      merge: (persisted, current) => safeMerge(persisted, current),
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        handle: s.handle,
        avatarHue: s.avatarHue,
        threads: s.threads,
        comments: s.comments,
        votedIds: s.votedIds,
        reportedIds: s.reportedIds,
        reportSentIds: s.reportSentIds,
        aliases: s.aliases,
      }),
    },
  ),
);

let flushing = false;
let flushAgain = false;

const isNamed = (x: { author: { anonymous: boolean } }) => !x.author.anonymous;

/**
 * Pushes this device's unsynced threads (oldest first), then comments (parents before replies). A pushed item gets its
 * server id, and anything pointing at the old id (comments of a thread, replies of a comment) is re-pointed; a thread
 * also records an alias so screens opened on its local id keep working. The handle is claimed once per run, and only
 * when a named item is waiting; if another user owns it, the local handle is dropped (`handleTaken`) and named items
 * wait for a new one while anonymous items still go out. Rejected items are skipped for the rest of the run, not
 * retried in a loop; the next post or feed load tries again. Safe to call concurrently.
 */
export async function flushCommunity(): Promise<void> {
  if (!isRemote()) return;
  if (flushing) {
    flushAgain = true;
    return;
  }
  flushing = true;
  // Ids that failed during this run are skipped by its later passes.
  const failed = new Set<string>();
  let namedOk: boolean | undefined;
  const canPostNamed = async (): Promise<boolean> => {
    if (namedOk !== undefined) return namedOk;
    const { handle, avatarHue } = useCommunity.getState();
    if (!handle) return (namedOk = false);
    const r = await pushHandle({ handle, avatarHue });
    if (r === 'taken') useCommunity.setState({ handle: undefined, handleTaken: true });
    return (namedOk = r === 'ok');
  };
  try {
    do {
      flushAgain = false;

      for (const t of [...useCommunity.getState().threads].reverse()) {
        const cur = useCommunity.getState().threads.find((x) => x.id === t.id);
        if (!cur || isServerId(cur.id) || failed.has(cur.id)) continue;
        if (isNamed(cur) && !(await canPostNamed())) {
          failed.add(cur.id);
          continue;
        }
        const id = await pushThread(cur);
        if (!id) {
          failed.add(cur.id);
          continue;
        }
        useCommunity.setState((s) => ({
          threads: s.threads.map((x) => (x.id === t.id ? { ...x, id } : x)),
          comments: s.comments.map((c) => (c.threadId === t.id ? { ...c, threadId: id } : c)),
          aliases: { ...s.aliases, [t.id]: id },
          tick: s.tick + 1,
        }));
        flushAgain = true;
      }

      for (const c of [...useCommunity.getState().comments]) {
        const cur = useCommunity.getState().comments.find((x) => x.id === c.id);
        if (!cur || isServerId(cur.id) || failed.has(cur.id)) continue;
        if (isNamed(cur) && !(await canPostNamed())) {
          failed.add(cur.id);
          continue;
        }
        const id = await pushComment(cur);
        if (!id) {
          failed.add(cur.id);
          continue;
        }
        useCommunity.setState((s) => ({
          comments: s.comments.map((x) => (x.id === c.id ? { ...x, id } : x.parentId === c.id ? { ...x, parentId: id } : x)),
          tick: s.tick + 1,
        }));
        flushAgain = true;
      }
    } while (flushAgain);
  } finally {
    flushing = false;
  }
}

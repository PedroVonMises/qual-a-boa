import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { safeMerge } from './safeMerge';

import { isRemote } from '@/data/supabaseClient';
import { pushClose, pushMessage, pushRead, pushTicket } from '@/data/sync/support';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { SupportMessage, SupportTicket, TicketTopic } from '@/domain/engage';

/** Business days promised in the automatic acknowledgement. There is no real backend yet. */
export const RESPONSE_DAYS = 2;

export const autoReplyText = (days: number = RESPONSE_DAYS) =>
  `Chamado salvo neste aparelho. O atendimento ainda não está ativo nesta versão; quando estiver, responderemos em até ${days} dias úteis.`;

/** Acknowledgement text once the server really has the ticket. Never shown before the insert succeeded. */
export const remoteAutoReplyText = (days: number = RESPONSE_DAYS) =>
  `Recebemos seu chamado. Resposta em até ${days} dias úteis.`;

/** Automatic acknowledgements carry this id suffix; they are never presented as written by a person. */
export const isAutomatic = (m: SupportMessage) => m.from === 'support' && m.id.endsWith('-auto');

const rid = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export interface NewTicketInput {
  topic: TicketTopic;
  eventId?: string;
  description: string;
}

interface SupportStore {
  tickets: SupportTicket[];
  /** Local ticket ids and local user-message ids the server does not have yet (empty when not remote). */
  unsynced: string[];
  /** Local ticket id -> server uuid. The local id stays the route/key; message ids are replaced by server ids. */
  remoteIds: Record<string, string>;
  /** Merges server tickets (status, support replies) into the local list. */
  mergeRemote: (remote: SupportTicket[]) => void;
  /** Creates the ticket with the user's text plus the automatic acknowledgement. Returns the ticket id. */
  createTicket: (input: NewTicketInput, now?: string) => string;
  /** Appends a user message. Reopens a closed ticket. Ignores blank text. Returns the message id or null. */
  sendMessage: (ticketId: string, text: string, now?: string) => string | null;
  /** Stamps readAt on the messages from support that the user has now seen. */
  markRead: (ticketId: string, now?: string) => void;
  closeTicket: (ticketId: string) => void;
  getTicket: (ticketId: string) => SupportTicket | undefined;
  unreadCount: (ticketId: string) => number;
}

export const useSupport = create<SupportStore>()(
  persist(
    (set, get) => ({
      tickets: [],
      unsynced: [],
      remoteIds: {},
      mergeRemote: (remote) => mergeRemote(remote),
      createTicket: (input, now = new Date().toISOString()) => {
        const id = rid('tk');
        const ticket: SupportTicket = {
          id,
          topic: input.topic,
          eventId: input.eventId,
          description: input.description.trim(),
          status: 'open',
          createdAt: now,
          messages: [
            { id: `${id}-m1`, ticketId: id, from: 'user', text: input.description.trim(), at: now },
            { id: `${id}-auto`, ticketId: id, from: 'support', text: autoReplyText(), at: now },
          ],
        };
        set((s) => ({
          tickets: [ticket, ...s.tickets],
          unsynced: isRemote() ? [...s.unsynced, id, `${id}-m1`] : s.unsynced,
        }));
        if (isRemote()) void syncTicket(id);
        return id;
      },
      sendMessage: (ticketId, text, now = new Date().toISOString()) => {
        const body = text.trim();
        if (!body || !get().tickets.some((t) => t.id === ticketId)) return null;
        const id = rid(`${ticketId}-m`);
        set((s) => ({
          tickets: s.tickets.map((t) =>
            t.id === ticketId
              ? {
                  ...t,
                  status: t.status === 'closed' ? 'open' : t.status,
                  messages: [...t.messages, { id, ticketId, from: 'user', text: body, at: now }],
                }
              : t,
          ),
          unsynced: isRemote() ? [...s.unsynced, id] : s.unsynced,
        }));
        if (isRemote()) void syncTicket(ticketId);
        return id;
      },
      markRead: (ticketId, now = new Date().toISOString()) => {
        const t = get().tickets.find((x) => x.id === ticketId);
        if (!t || !t.messages.some((m) => m.from === 'support' && !m.readAt)) return;
        if (isRemote()) void pushRead(t.messages.filter((m) => m.from === 'support' && !m.readAt).map((m) => m.id), now);
        set((s) => ({
          tickets: s.tickets.map((x) =>
            x.id === ticketId
              ? { ...x, messages: x.messages.map((m) => (m.from === 'support' && !m.readAt ? { ...m, readAt: now } : m)) }
              : x,
          ),
        }));
      },
      closeTicket: (ticketId) => {
        set((s) => ({ tickets: s.tickets.map((t) => (t.id === ticketId ? { ...t, status: 'closed' } : t)) }));
        const sid = get().remoteIds[ticketId] ?? ticketId;
        if (isRemote() && !get().unsynced.includes(ticketId)) void pushClose(sid);
      },
      getTicket: (ticketId) => get().tickets.find((t) => t.id === ticketId),
      unreadCount: (ticketId) =>
        get()
          .tickets.find((t) => t.id === ticketId)
          ?.messages.filter((m) => m.from === 'support' && !m.readAt).length ?? 0,
    }),
    {
      name: 'qab.support',
      merge: (persisted, current) => safeMerge(persisted, current),
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ tickets: s.tickets, unsynced: s.unsynced, remoteIds: s.remoteIds }),
    },
  ),
);

// --- Remote sync (fire-and-forget; the local store stays the source of truth) ---------------------------------------

const chains = new Map<string, Promise<void>>();

/** Serializes pushes per ticket so a message sent right after creation waits for the ticket insert. */
function syncTicket(localId: string): Promise<void> {
  const next = (chains.get(localId) ?? Promise.resolve()).then(() => runSync(localId)).catch(() => undefined);
  chains.set(localId, next);
  return next;
}

async function runSync(localId: string): Promise<void> {
  const st = () => useSupport.getState();
  let ticket = st().getTicket(localId);
  if (!ticket) return;
  let sid = st().remoteIds[localId];
  if (!sid && !st().unsynced.includes(localId)) sid = localId; // pulled ticket: its id is already the server uuid
  if (!sid) {
    const created = await pushTicket({ topic: ticket.topic, eventId: ticket.eventId, description: ticket.description });
    if (!created) return; // stays flagged unsynced; the next message or edit tries again, no retry loop
    sid = created;
    useSupport.setState((s) => ({
      remoteIds: { ...s.remoteIds, [localId]: created },
      unsynced: s.unsynced.filter((x) => x !== localId),
      // The server has the ticket now, so the acknowledgement may say so.
      tickets: s.tickets.map((t) =>
        t.id === localId
          ? { ...t, messages: t.messages.map((m) => (m.id === `${localId}-auto` ? { ...m, text: remoteAutoReplyText() } : m)) }
          : t,
      ),
    }));
  }
  ticket = st().getTicket(localId);
  for (const m of ticket?.messages ?? []) {
    if (m.from !== 'user' || !st().unsynced.includes(m.id)) continue;
    const mid = await pushMessage(sid, m.text);
    if (!mid) return; // keep order: later messages wait behind this one
    useSupport.setState((s) => ({
      unsynced: s.unsynced.filter((x) => x !== m.id),
      tickets: s.tickets.map((t) =>
        t.id === localId ? { ...t, messages: t.messages.map((x) => (x.id === m.id ? { ...x, id: mid } : x)) } : t,
      ),
    }));
  }
  if (st().getTicket(localId)?.status === 'closed') await pushClose(sid);
}

function mergeRemote(remote: SupportTicket[]): void {
  useSupport.setState((s) => {
    const byServer = new Map(Object.entries(s.remoteIds).map(([local, server]) => [server, local]));
    const seen = new Set<string>();
    const next = s.tickets.map((t) => {
      const server = s.remoteIds[t.id] ?? t.id;
      const r = remote.find((x) => x.id === server);
      if (!r || s.unsynced.includes(t.id)) return t;
      seen.add(r.id);
      const known = new Map(t.messages.map((m) => [m.id, m]));
      const fromServer = r.messages.map((m) => ({ ...m, ticketId: t.id, readAt: known.get(m.id)?.readAt ?? m.readAt }));
      const ids = new Set(fromServer.map((m) => m.id));
      // Keep the local acknowledgement and anything the server does not have yet.
      const local = t.messages.filter((m) => !ids.has(m.id) && (isAutomatic(m) || s.unsynced.includes(m.id)));
      const messages = [...fromServer, ...local].sort((a, b) => a.at.localeCompare(b.at));
      // A closed ticket the user closed locally but the server has not heard yet stays closed.
      return { ...t, status: r.status, messages };
    });
    const added = remote.filter((r) => !seen.has(r.id) && !byServer.has(r.id) && !next.some((t) => t.id === r.id));
    if (!added.length && next.every((t, i) => t === s.tickets[i])) return s;
    return { tickets: [...next, ...added].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
  });
}

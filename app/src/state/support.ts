import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { safeMerge } from './safeMerge';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { SupportMessage, SupportTicket, TicketTopic } from '@/domain/engage';

/** Business days promised in the automatic acknowledgement. There is no real backend yet. */
export const RESPONSE_DAYS = 2;

export const autoReplyText = (days: number = RESPONSE_DAYS) =>
  `Chamado salvo neste aparelho. O atendimento ainda não está ativo nesta versão; quando estiver, responderemos em até ${days} dias úteis.`;

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
        set((s) => ({ tickets: [ticket, ...s.tickets] }));
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
        }));
        return id;
      },
      markRead: (ticketId, now = new Date().toISOString()) => {
        const t = get().tickets.find((x) => x.id === ticketId);
        if (!t || !t.messages.some((m) => m.from === 'support' && !m.readAt)) return;
        set((s) => ({
          tickets: s.tickets.map((x) =>
            x.id === ticketId
              ? { ...x, messages: x.messages.map((m) => (m.from === 'support' && !m.readAt ? { ...m, readAt: now } : m)) }
              : x,
          ),
        }));
      },
      closeTicket: (ticketId) =>
        set((s) => ({ tickets: s.tickets.map((t) => (t.id === ticketId ? { ...t, status: 'closed' } : t)) })),
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
      partialize: (s) => ({ tickets: s.tickets }),
    },
  ),
);

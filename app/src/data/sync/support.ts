import { useQuery } from '@tanstack/react-query';

import type { SupportMessage, SupportTicket, TicketStatus, TicketTopic } from '@/domain/engage';

import { ensureUserId, getSupabase, isRemote } from '../supabaseClient';
import { UUID_RE } from './reviews';

import { useSupport } from '@/state/support';

const warn = (what: string, err: unknown) => {
  if (__DEV__) console.warn(`[sync/support] ${what} failed`, err);
};

/** Row of `support_messages` (`sender` is the SupportMessage.from column). */
export interface MessageRow {
  id: string;
  ticket_id: string;
  sender: 'user' | 'support';
  text: string;
  created_at: string;
  read_at: string | null;
}

/** Row of `support_tickets` with its embedded messages. */
export interface TicketRow {
  id: string;
  topic: TicketTopic;
  event_id: string | null;
  description: string;
  status: TicketStatus;
  created_at: string;
  support_messages?: MessageRow[] | null;
}

export function mapMessageRow(row: MessageRow): SupportMessage {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    from: row.sender,
    text: row.text,
    at: row.created_at,
    ...(row.read_at ? { readAt: row.read_at } : {}),
  };
}

export function mapTicketRow(row: TicketRow): SupportTicket {
  const messages = (row.support_messages ?? []).map(mapMessageRow).sort((a, b) => a.at.localeCompare(b.at));
  return {
    id: row.id,
    topic: row.topic,
    ...(row.event_id ? { eventId: row.event_id } : {}),
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    messages,
  };
}

/** SupportMessage -> insert payload (`from` -> `sender`). Only user messages can be inserted. */
export function messagePayload(ticketId: string, text: string) {
  return { ticket_id: ticketId, sender: 'user' as const, text };
}

/** The signed-in user's tickets with messages, newest first. Throws on network/RLS errors. */
export async function pullTickets(): Promise<SupportTicket[]> {
  const sb = getSupabase();
  if (!sb || !isRemote()) return [];
  const { data, error } = await sb
    .from('support_tickets')
    .select('*, support_messages(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as TicketRow[]).map(mapTicketRow);
}

/** Inserts a ticket. Returns the server uuid, or null when not remote, signed out or rejected. Never throws. */
export async function pushTicket(input: { topic: TicketTopic; eventId?: string; description: string }): Promise<string | null> {
  try {
    const sb = getSupabase();
    if (!sb || !isRemote()) return null;
    const uid = await ensureUserId();
    if (!uid) return null;
    const { data, error } = await sb
      .from('support_tickets')
      .insert({
        user_id: uid,
        topic: input.topic,
        event_id: input.eventId && UUID_RE.test(input.eventId) ? input.eventId : null,
        description: input.description,
      })
      .select('id')
      .single();
    if (error) {
      warn('ticket insert', error);
      return null;
    }
    return (data as { id: string }).id;
  } catch (e) {
    warn('ticket', e);
    return null;
  }
}

/** Inserts a user message on a server ticket. Returns the server message uuid or null. Never throws. */
export async function pushMessage(ticketId: string, text: string): Promise<string | null> {
  try {
    const sb = getSupabase();
    if (!sb || !isRemote() || !UUID_RE.test(ticketId)) return null;
    if (!(await ensureUserId())) return null;
    const { data, error } = await sb.from('support_messages').insert(messagePayload(ticketId, text)).select('id').single();
    if (error) {
      warn('message insert', error);
      return null;
    }
    return (data as { id: string }).id;
  } catch (e) {
    warn('message', e);
    return null;
  }
}

/** Closes a server ticket (the only status change RLS lets the user make). */
export async function pushClose(ticketId: string): Promise<boolean> {
  try {
    const sb = getSupabase();
    if (!sb || !isRemote() || !UUID_RE.test(ticketId)) return false;
    if (!(await ensureUserId())) return false;
    const { error } = await sb.from('support_tickets').update({ status: 'closed' }).eq('id', ticketId);
    if (error) warn('close', error);
    return !error;
  } catch (e) {
    warn('close', e);
    return false;
  }
}

/** Stamps read_at on server messages the user has now seen. */
export async function pushRead(messageIds: string[], at: string = new Date().toISOString()): Promise<boolean> {
  const ids = messageIds.filter((id) => UUID_RE.test(id));
  if (!ids.length) return false;
  try {
    const sb = getSupabase();
    if (!sb || !isRemote()) return false;
    if (!(await ensureUserId())) return false;
    const { error } = await sb.from('support_messages').update({ read_at: at }).in('id', ids);
    if (error) warn('read', error);
    return !error;
  } catch (e) {
    warn('read', e);
    return false;
  }
}

/** Remote tickets; merged into the local store so support replies show up in Mensagens/Conversa. */
export function useRemoteTickets() {
  return useQuery({
    queryKey: ['remote', 'tickets'],
    enabled: isRemote(),
    refetchInterval: 30_000, // support replies arrive server-side; poll while a support screen is open
    queryFn: async () => {
      const list = await pullTickets();
      useSupport.getState().mergeRemote(list);
      return list;
    },
  });
}

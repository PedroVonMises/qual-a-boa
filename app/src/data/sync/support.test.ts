import { fakeClient, flush, type Call, type Handler } from './fakeClient';
import { mapTicketRow, messagePayload, pullTickets, pushTicket, type TicketRow } from './support';

import { autoReplyText, isAutomatic, remoteAutoReplyText, useSupport } from '@/state/support';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

let mockClient: unknown = null;
let mockRemote = true;
jest.mock('../supabaseClient', () => ({
  isRemote: () => mockRemote,
  getSupabase: () => (mockRemote ? mockClient : null),
  ensureUserId: async () => (mockRemote ? 'user-1' : null),
}));

const TK = '44444444-4444-4444-8444-444444444444';
const M1 = '55555555-5555-4555-8555-555555555555';
const M2 = '66666666-6666-4666-8666-666666666666';
const M3 = '77777777-7777-4777-8777-777777777777';

const ticketRow: TicketRow = {
  id: TK,
  topic: 'ingresso',
  event_id: null,
  description: 'Meu ingresso não abre',
  status: 'answered',
  created_at: '2026-10-24T10:00:00Z',
  support_messages: [
    { id: M2, ticket_id: TK, sender: 'support', text: 'Olá, vamos ver.', created_at: '2026-10-24T11:00:00Z', read_at: null },
    { id: M1, ticket_id: TK, sender: 'user', text: 'Meu ingresso não abre', created_at: '2026-10-24T10:00:01Z', read_at: null },
  ],
};

function use(handler: Handler) {
  const f = fakeClient(handler);
  mockClient = f.client;
  return f.calls;
}
const okServer: Handler = (c: Call) => {
  if (c.table === 'support_tickets' && c.op === 'insert') return { data: { id: TK } };
  if (c.table === 'support_messages' && c.op === 'insert') return { data: { id: M1 } };
  return {};
};

beforeEach(() => {
  mockRemote = true;
  useSupport.setState({ tickets: [], unsynced: [], remoteIds: {} });
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('support mapping', () => {
  it('maps sender <-> from, null event and sorts messages', () => {
    const t = mapTicketRow(ticketRow);
    expect(t).toMatchObject({ id: TK, topic: 'ingresso', status: 'answered', createdAt: '2026-10-24T10:00:00Z' });
    expect(t).not.toHaveProperty('eventId');
    expect(t.messages.map((m) => [m.id, m.from])).toEqual([[M1, 'user'], [M2, 'support']]);
    expect(t.messages[0]).not.toHaveProperty('readAt');
    expect(messagePayload(TK, 'oi')).toEqual({ ticket_id: TK, sender: 'user', text: 'oi' });
  });

  it('pullTickets selects tickets with embedded messages', async () => {
    const calls = use(() => ({ data: [ticketRow] }));
    const list = await pullTickets();
    expect(list).toHaveLength(1);
    expect(calls[0]).toMatchObject({ table: 'support_tickets', op: 'select' });
  });
});

describe('support push', () => {
  it('createTicket: honest local copy first, remote acknowledgement only after the insert', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const calls = use(async (c) => {
      if (c.table === 'support_tickets') await gate;
      return okServer(c);
    });
    const id = useSupport.getState().createTicket({ topic: 'ingresso', description: 'Meu ingresso não abre' });
    await flush();
    let t = useSupport.getState().getTicket(id)!;
    expect(t.messages[1].text).toBe(autoReplyText());
    expect(useSupport.getState().unsynced).toContain(id);

    release();
    await flush();
    await flush();
    await flush();
    t = useSupport.getState().getTicket(id)!;
    expect(calls.map((c) => [c.table, c.op])).toEqual([
      ['support_tickets', 'insert'],
      ['support_messages', 'insert'],
    ]);
    expect(calls[0].payload).toMatchObject({ topic: 'ingresso', description: 'Meu ingresso não abre', event_id: null });
    expect(calls[1].payload).toEqual({ ticket_id: TK, sender: 'user', text: 'Meu ingresso não abre' });
    expect(useSupport.getState().remoteIds[id]).toBe(TK);
    expect(t.messages[0].id).toBe(M1); // temp message id replaced by the server uuid
    expect(t.messages[1].text).toBe(remoteAutoReplyText());
    expect(t.messages[1].text).toBe('Recebemos seu chamado. Resposta em até 2 dias úteis.');
    expect(isAutomatic(t.messages[1])).toBe(true);
    expect(useSupport.getState().unsynced).toEqual([]);
  });

  it('a rejected ticket keeps the "salvo neste aparelho" copy, stays unsynced and is not retried in a loop', async () => {
    const calls = use(() => ({ error: { code: '42501', message: 'rls' } }));
    const id = useSupport.getState().createTicket({ topic: 'outro', description: 'Preciso de ajuda aqui' });
    await flush();
    await flush();
    expect(calls).toHaveLength(1);
    const t = useSupport.getState().getTicket(id)!;
    expect(t.messages[1].text).toBe(autoReplyText());
    expect(useSupport.getState().unsynced).toEqual([id, `${id}-m1`]);
  });

  it('sendMessage right after creation waits for the ticket, then sends in order', async () => {
    const calls = use((c) =>
      c.table === 'support_messages' && c.op === 'insert'
        ? { data: { id: (c.payload as { text: string }).text === 'Alguém aí?' ? M3 : M1 } }
        : okServer(c),
    );
    const id = useSupport.getState().createTicket({ topic: 'outro', description: 'Preciso de ajuda aqui' });
    const mid = useSupport.getState().sendMessage(id, 'Alguém aí?')!;
    expect(mid).toBeTruthy();
    for (let i = 0; i < 6; i++) await flush();
    expect(calls.map((c) => c.table + ':' + c.op)).toEqual([
      'support_tickets:insert',
      'support_messages:insert',
      'support_messages:insert',
    ]);
    expect(useSupport.getState().getTicket(id)!.messages.map((m) => m.id)).toEqual([M1, `${id}-auto`, M3]);
    expect(useSupport.getState().unsynced).toEqual([]);
  });

  it('pushTicket sends only allowed columns', async () => {
    const calls = use(okServer);
    const ev = '88888888-8888-4888-8888-888888888888';
    await expect(pushTicket({ topic: 'evento', eventId: ev, description: 'x' })).resolves.toBe(TK);
    expect(calls[0].payload).toEqual({ user_id: 'user-1', topic: 'evento', event_id: ev, description: 'x' });
  });

  it('closing a synced ticket pushes status closed', async () => {
    const calls = use(okServer);
    const id = useSupport.getState().createTicket({ topic: 'outro', description: 'Preciso de ajuda aqui' });
    for (let i = 0; i < 4; i++) await flush();
    useSupport.getState().closeTicket(id);
    await flush();
    const last = calls[calls.length - 1];
    expect(last).toMatchObject({ table: 'support_tickets', op: 'update', payload: { status: 'closed' } });
    expect(last.filters).toEqual([['id', 'eq', TK]]);
  });

  it('mergeRemote adds support replies to a synced ticket and keeps the local acknowledgement', async () => {
    use(okServer);
    const id = useSupport.getState().createTicket({ topic: 'ingresso', description: 'Meu ingresso não abre' });
    for (let i = 0; i < 4; i++) await flush();
    useSupport.getState().mergeRemote([mapTicketRow(ticketRow)]);
    const s = useSupport.getState();
    expect(s.tickets).toHaveLength(1);
    const t = s.getTicket(id)!;
    expect(t.status).toBe('answered');
    expect(t.messages.map((m) => m.id)).toEqual([M1, M2, `${id}-auto`]);
    expect(s.unreadCount(id)).toBe(2);
  });

  it('mergeRemote adds tickets known only to the server', () => {
    useSupport.getState().mergeRemote([mapTicketRow(ticketRow)]);
    expect(useSupport.getState().tickets.map((t) => t.id)).toEqual([TK]);
  });
});

describe('not remote', () => {
  it('is a no-op and keeps the local copy', async () => {
    mockRemote = false;
    const calls = use(okServer);
    const id = useSupport.getState().createTicket({ topic: 'outro', description: 'Preciso de ajuda aqui' });
    useSupport.getState().sendMessage(id, 'oi');
    useSupport.getState().markRead(id);
    useSupport.getState().closeTicket(id);
    await flush();
    expect(calls).toHaveLength(0);
    expect(useSupport.getState().unsynced).toEqual([]);
    expect(useSupport.getState().getTicket(id)!.messages[1].text).toBe(autoReplyText());
    await expect(pullTickets()).resolves.toEqual([]);
    await expect(pushTicket({ topic: 'outro', description: 'x' })).resolves.toBeNull();
  });
});

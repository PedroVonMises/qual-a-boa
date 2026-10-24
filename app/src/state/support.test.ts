import { autoReplyText, isAutomatic, useSupport } from './support';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

beforeEach(() => useSupport.setState({ tickets: [] }));

describe('support store', () => {
  it('creates a ticket with the user message and a labeled automatic acknowledgement', () => {
    const id = useSupport.getState().createTicket({ topic: 'ingresso', eventId: 'e01', description: '  Meu ingresso não abre  ' });
    const t = useSupport.getState().getTicket(id)!;
    expect(t.status).toBe('open');
    expect(t.eventId).toBe('e01');
    expect(t.description).toBe('Meu ingresso não abre');
    expect(t.messages).toHaveLength(2);
    expect(t.messages[0]).toMatchObject({ from: 'user', text: 'Meu ingresso não abre' });
    expect(t.messages[1].text).toBe(autoReplyText());
    expect(t.messages[1].text).toContain('dias úteis');
    expect(isAutomatic(t.messages[1])).toBe(true);
    expect(isAutomatic(t.messages[0])).toBe(false);
  });

  it('never simulates a human reply after sending a message', () => {
    const id = useSupport.getState().createTicket({ topic: 'outro', description: 'Preciso de ajuda aqui' });
    useSupport.getState().sendMessage(id, 'Alguém aí?');
    const t = useSupport.getState().getTicket(id)!;
    expect(t.messages.map((m) => m.from)).toEqual(['user', 'support', 'user']);
    expect(t.status).toBe('open');
  });

  it('ignores blank messages and unknown tickets', () => {
    const id = useSupport.getState().createTicket({ topic: 'outro', description: 'Preciso de ajuda aqui' });
    expect(useSupport.getState().sendMessage(id, '   ')).toBeNull();
    expect(useSupport.getState().sendMessage('nope', 'oi')).toBeNull();
    expect(useSupport.getState().getTicket(id)!.messages).toHaveLength(2);
  });

  it('marks support messages read and counts unread', () => {
    const id = useSupport.getState().createTicket({ topic: 'conta', description: 'Apagar meus dados' });
    expect(useSupport.getState().unreadCount(id)).toBe(1);
    useSupport.getState().markRead(id, '2026-10-24T15:00:00.000Z');
    expect(useSupport.getState().unreadCount(id)).toBe(0);
    const msgs = useSupport.getState().getTicket(id)!.messages;
    expect(msgs[1].readAt).toBe('2026-10-24T15:00:00.000Z');
    expect(msgs[0].readAt).toBeUndefined();
  });

  it('closes and reopens on a new message; newest ticket first', () => {
    const a = useSupport.getState().createTicket({ topic: 'conta', description: 'Primeiro chamado aqui' });
    const b = useSupport.getState().createTicket({ topic: 'casa', description: 'Segundo chamado aqui' });
    expect(useSupport.getState().tickets.map((t) => t.id)).toEqual([b, a]);
    useSupport.getState().closeTicket(a);
    expect(useSupport.getState().getTicket(a)!.status).toBe('closed');
    useSupport.getState().sendMessage(a, 'Voltei');
    expect(useSupport.getState().getTicket(a)!.status).toBe('open');
  });
});

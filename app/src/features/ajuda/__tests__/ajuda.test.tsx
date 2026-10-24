import '@/ui/testSetup';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { SeedRepo, setRepo } from '@/data';
import { MINI_NOW, miniDataset } from '@/data/__fixtures__/mini';
import { useSupport } from '@/state/support';
import { AjudaScreen } from '../AjudaScreen';
import { ConversaScreen, TypingIndicator } from '../ConversaScreen';
import { MensagensScreen } from '../MensagensScreen';
import { NovoChamadoScreen } from '../NovoChamadoScreen';
import { commonFaq, searchFaq } from '../faq';
import { DESCRIPTION_MAX, validateDescription } from '../tickets';

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const wrap = (el: React.ReactElement) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{el}</QueryClientProvider>
);

beforeEach(() => {
  mockPush.mockClear();
  mockReplace.mockClear();
  mockParams = {};
  setRepo(new SeedRepo(miniDataset, () => Date.parse(MINI_NOW)));
  useSupport.setState({ tickets: [] });
});

describe('validateDescription', () => {
  it('enforces 10..1000 trimmed characters', () => {
    expect(validateDescription('curto').ok).toBe(false);
    expect(validateDescription('         123456789   ').ok).toBe(false);
    expect(validateDescription('1234567890').ok).toBe(true);
    expect(validateDescription('a'.repeat(DESCRIPTION_MAX)).ok).toBe(true);
    const over = validateDescription('a'.repeat(DESCRIPTION_MAX + 1));
    expect(over.ok).toBe(false);
    expect(over.error).toContain('1000');
    expect(validateDescription('x').error).toContain('10');
  });
});

describe('faq', () => {
  it('searches accent-insensitively and lists common topics', () => {
    expect(searchFaq('LGPD').map((f) => f.id)).toContain('apagar-dados');
    expect(searchFaq('horario').length).toBeGreaterThan(0);
    expect(searchFaq('zzzzqq')).toHaveLength(0);
    expect(commonFaq()).toHaveLength(5);
  });
});

describe('AjudaScreen', () => {
  it('shows common topics, filters by search and expands an answer', async () => {
    await render(wrap(<AjudaScreen />));
    expect(screen.getByText('Assuntos comuns')).toBeTruthy();
    expect(screen.getByText(/Resposta em até 2 dias úteis/)).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Buscar na ajuda'), 'lgpd');
    expect(screen.getByText('Resultados')).toBeTruthy();
    expect(screen.queryByText('Meu ingresso não abre')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Apagar meus dados (LGPD)'));
    expect(screen.getByText(/nunca enviamos nem pedimos senha/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Falar com o suporte'));
    expect(mockPush).toHaveBeenCalledWith('/ajuda/novo');
  });
});

describe('NovoChamadoScreen', () => {
  it('blocks submit with a labeled error, then creates the ticket and opens the conversation', async () => {
    await render(wrap(<NovoChamadoScreen />));
    await fireEvent.press(screen.getByTestId('novo-enviar'));
    expect(useSupport.getState().tickets).toHaveLength(0);
    expect(screen.getByText('Escolha um assunto.')).toBeTruthy();
    expect(screen.getByText(/pelo menos 10 caracteres/)).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Problema com ingresso'));
    const input = screen.getByLabelText('O que aconteceu? Obrigatório');
    expect(input.props.multiline).toBe(true);
    await fireEvent.changeText(input, 'Meu ingresso não abre no app');
    await fireEvent.press(screen.getByTestId('novo-enviar'));

    const tickets = useSupport.getState().tickets;
    expect(tickets).toHaveLength(1);
    expect(tickets[0].topic).toBe('ingresso');
    expect(mockReplace).toHaveBeenCalledWith(`/ajuda/suporte/${tickets[0].id}`);
  });

  it('marks the attach control as disabled and "em breve"', async () => {
    await render(wrap(<NovoChamadoScreen />));
    expect(screen.getByLabelText('Anexar print (opcional), em breve').props.accessibilityState.disabled).toBe(true);
  });
});

describe('MensagensScreen', () => {
  it('lists tickets with a text status chip and splits open from closed', async () => {
    const a = useSupport.getState().createTicket({ topic: 'ingresso', description: 'Meu ingresso não abre' });
    const b = useSupport.getState().createTicket({ topic: 'casa', description: 'Endereço errado da casa' });
    useSupport.getState().closeTicket(b);
    await render(wrap(<MensagensScreen />));
    expect(screen.getByText('Abertos · 1')).toBeTruthy();
    expect(screen.getByText('Aberto')).toBeTruthy();
    expect(screen.queryByText('Encerrado')).toBeNull();
    await fireEvent.press(screen.getByTestId(`ticket-${a}`));
    expect(mockPush).toHaveBeenCalledWith(`/ajuda/suporte/${a}`);
    await fireEvent.press(screen.getByText('Encerrados · 1'));
    expect(screen.getByText('Encerrado')).toBeTruthy();
  });
});

describe('ConversaScreen', () => {
  it('labels the automatic reply, marks it read, shows the security note and sends quick replies', async () => {
    const id = useSupport.getState().createTicket({ topic: 'ingresso', eventId: 'e01', description: 'Meu ingresso não abre' });
    mockParams = { id };
    await render(wrap(<ConversaScreen />));
    expect(screen.getAllByText('Mensagem automática').length).toBeGreaterThan(0);
    expect(screen.getByText(/Recebemos seu chamado. Resposta em até 2 dias úteis/)).toBeTruthy();
    expect(screen.getByText('Nunca pedimos sua senha ou dados do cartão.')).toBeTruthy();
    expect(useSupport.getState().unreadCount(id)).toBe(0);
    expect(screen.getByLabelText('Anexar, em breve').props.accessibilityState.disabled).toBe(true);
    expect(await screen.findByText('Sobre este evento')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Resposta rápida: Obrigado'));
    const msgs = useSupport.getState().getTicket(id)!.messages;
    expect(msgs[msgs.length - 1]).toMatchObject({ from: 'user', text: 'Obrigado' });
    expect(screen.getAllByText(/Enviada/)).toHaveLength(2);

    await fireEvent.changeText(screen.getByTestId('conversa-input'), 'Mais uma dúvida');
    await fireEvent.press(screen.getByTestId('conversa-enviar'));
    expect(useSupport.getState().getTicket(id)!.messages).toHaveLength(4);
  });

  it('typing indicator lives in a polite live region', async () => {
    await render(<TypingIndicator visible />);
    expect(screen.getByTestId('typing-indicator')).toBeTruthy();
    expect(screen.getByLabelText('A equipe está escrevendo').props.accessibilityLiveRegion).toBe('polite');
  });

  it('shows not-found for an unknown ticket', async () => {
    mockParams = { id: 'nada' };
    await render(wrap(<ConversaScreen />));
    expect(screen.getByText('Chamado não encontrado')).toBeTruthy();
  });
});

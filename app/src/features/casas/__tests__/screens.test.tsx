import '@/ui/testSetup';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { resetCasasDemo, submitEvent, useCasasDemo } from '@/data/casas';
import { AssinaturaScreen } from '../AssinaturaScreen';
import { EmpresaScreen } from '../EmpresaScreen';
import { NovaFestaScreen } from '../NovaFestaScreen';
import { PagamentoScreen } from '../PagamentoScreen';
import { PainelScreen } from '../PainelScreen';
import { PlanoScreen } from '../PlanoScreen';
import { VincularScreen } from '../VincularScreen';
import { useCasasFlow, useFestaDrafts } from '../store';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockRedirect = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack, canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
  Redirect: ({ href }: { href: string }) => {
    mockRedirect(href);
    return null;
  },
}));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(() => Promise.resolve({ type: 'opened' })) }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn(() => Promise.resolve({ canceled: true, assets: null })) }));
jest.mock('@/lib/cep', () => ({
  ...jest.requireActual('@/lib/cep'),
  lookupCep: jest.fn(async () => ({ street: 'Rua Joaquim Lírio', district: 'Praia do Canto', city: 'Vitória', uf: 'ES' })),
}));

// Monday 9 Nov 2026, 12:00 in São Paulo. Demo: Casa Maré, period until 4 Dec, festas on Fri 13 (published) and 20 (in review).
const NOW = Date.parse('2026-11-09T15:00:00Z');
const realNow = Date.now.bind(Date);
const at = (iso: string) => new Date(iso).toISOString();

const show = (el: ReactElement) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{el}</QueryClientProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  // Shifted clock (still ticking, so waitFor timeouts work).
  const offset = NOW - realNow();
  jest.spyOn(Date, 'now').mockImplementation(() => realNow() + offset);
  mockParams = {};
  resetCasasDemo(NOW);
  useCasasFlow.getState().reset();
  useFestaDrafts.setState({ drafts: {} });
});
afterEach(() => jest.restoreAllMocks());

async function fillNovember(n: number) {
  const days = ['2026-11-21', '2026-11-22', '2026-11-27', '2026-11-28'];
  for (let i = 0; i < n; i++) {
    const res = await submitEvent('demo-casa-mare', { title: `Extra ${i}`, startsAt: at(`${days[i]}T23:00:00-03:00`), isFree: true, genreSlugs: [] }, NOW);
    expect(res.ok).toBe(true);
  }
}

describe('Plano', () => {
  it('shows one plan card with the mono price, the features and the fine print', async () => {
    await show(<PlanoScreen />);
    expect(screen.getByText('PARA CASAS NOTURNAS')).toBeTruthy();
    expect(screen.getByText('Sua festa no Qual a boa?')).toBeTruthy();
    expect(screen.getByTestId('casas-preco')).toHaveTextContent('R$ 299');
    expect(screen.getByText('4 festas por mês, contadas pelo mês da festa')).toBeTruthy();
    expect(screen.getByText('Link direto pro seu ingresso')).toBeTruthy();
    expect(screen.getByText(/O Qual a boa\? não vende ingressos\./)).toBeTruthy();
    expect(screen.getByText('O que conta na cota?')).toBeTruthy();
    // Demo user already has Casa Maré: shortcut to the panel.
    await waitFor(() => expect(screen.getByTestId('casas-atalho-painel')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('casas-assinar'));
    expect(mockPush).toHaveBeenCalledWith('/casas/vincular');
  });
});

describe('Assinar → painel (demonstração)', () => {
  it('runs vincular (casa nova) → empresa → pagamento → assinatura → painel', async () => {
    // 1/3: casa nova with the AddressForm.
    const v = await show(<VincularScreen />);
    expect(screen.getByLabelText('Passo 1 de 3: Sua casa')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('casas-nao-esta'));
    await fireEvent.press(screen.getByTestId('casas-nova-continuar'));
    expect(screen.getByTestId('casas-nova-nome-error')).toHaveTextContent('Digite o nome da casa (de 2 a 120 letras).');
    expect(mockPush).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByTestId('casas-nova-nome'), 'Bar do Teste');
    await fireEvent.changeText(screen.getByTestId('casas-endereco-cep'), '29055000');
    await waitFor(() => expect(screen.getByTestId('casas-endereco-street').props.value).toBe('Rua Joaquim Lírio'));
    await fireEvent.changeText(screen.getByTestId('casas-endereco-number'), '100');
    await fireEvent.press(screen.getByTestId('casas-nova-continuar'));
    expect(mockPush).toHaveBeenLastCalledWith('/casas/vincular/empresa');
    expect(useCasasFlow.getState().venue).toEqual({
      kind: 'new',
      proposed: { name: 'Bar do Teste', address: 'Rua Joaquim Lírio, 100 - Vitória/ES', bairro: 'Praia do Canto', cep: '29055-000' },
    });
    await v.unmount();

    // 2/3: errors inline, CNPJ mask, required checkbox.
    const e = await show(<EmpresaScreen />);
    await fireEvent.press(screen.getByTestId('casas-empresa-continuar'));
    expect(screen.getByTestId('casas-cnpj-error')).toHaveTextContent('Digite os 14 números do CNPJ.');
    expect(screen.getByTestId('casas-responsavel-check-error')).toHaveTextContent('Confirme que você é responsável pela casa.');
    await fireEvent.changeText(screen.getByTestId('casas-cnpj'), '11444777000162');
    expect(screen.getByTestId('casas-cnpj').props.value).toBe('11.444.777/0001-62');
    await fireEvent.press(screen.getByTestId('casas-empresa-continuar'));
    expect(screen.getByTestId('casas-cnpj-error')).toHaveTextContent('CNPJ inválido. Confira os números.');
    await fireEvent.changeText(screen.getByTestId('casas-cnpj'), '11444777000161');
    await fireEvent.changeText(screen.getByTestId('casas-razao'), 'Bar do Teste Ltda');
    await fireEvent.changeText(screen.getByTestId('casas-responsavel'), 'Ana Souza');
    await fireEvent.changeText(screen.getByTestId('casas-whatsapp'), '27999990000');
    expect(screen.getByTestId('casas-whatsapp').props.value).toBe('(27) 99999-0000');
    await fireEvent.press(screen.getByTestId('casas-responsavel-check'));
    expect(screen.getByTestId('casas-responsavel-check').props.accessibilityState).toMatchObject({ checked: true });
    await fireEvent.press(screen.getByTestId('casas-empresa-continuar'));
    expect(mockPush).toHaveBeenLastCalledWith('/casas/vincular/pagamento');
    await e.unmount();

    // 3/3: summary and checkout (demo: no Stripe url).
    const p = await show(<PagamentoScreen />);
    expect(screen.getByText('Bar do Teste')).toBeTruthy();
    expect(screen.getByText('11.444.777/0001-61')).toBeTruthy();
    expect(screen.getByText('R$ 299,00/mês')).toBeTruthy();
    expect(screen.getByText('09/12/2026')).toBeTruthy();
    expect(screen.getByText(/Você termina o pagamento no navegador/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('casas-pagar'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/casas/assinatura?status=sucesso'));
    const claimed = useCasasFlow.getState().claimedId!;
    const acc = useCasasDemo.getState().accounts.find((a) => a.id === claimed)!;
    expect(acc.status).toBe('pending');
    expect(acc.whatsapp).toBe('+5527999990000');
    expect(acc.subscription?.status).toBe('active');
    await p.unmount();

    // Stripe return.
    mockParams = { status: 'sucesso' };
    const a = await show(<AssinaturaScreen />);
    expect(await screen.findByTestId('casas-assinatura-ativa')).toBeTruthy();
    expect(screen.getByText('Assinatura ativa')).toBeTruthy();
    expect(screen.getByText('Verificando sua casa')).toBeTruthy();
    expect(screen.getByText(/A gente te avisa por e-mail quando terminar\./)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('casas-ir-painel'));
    expect(mockReplace).toHaveBeenLastCalledWith('/casas/painel');
    await a.unmount();

    // Panel of the new casa: still in verification, so no festa yet.
    mockParams = {};
    await show(<PainelScreen />);
    expect(await screen.findByTestId('casas-painel-nome')).toHaveTextContent('Bar do Teste');
    expect(screen.getByTestId('casas-painel-nota')).toHaveTextContent(/A gente ainda está conferindo sua casa/);
    expect(screen.getByTestId('casas-cadastrar-festa')).toBeDisabled();
  });

  it('offers the fix when the CNPJ is already registered', async () => {
    useCasasFlow.getState().setVenue({ kind: 'new', proposed: { name: 'Outro Bar', address: 'Rua B, 1 - Vitória/ES' } });
    useCasasFlow.getState().setCompany({ cnpj: '11.222.333/0001-81', legalName: 'Outro Ltda', contactName: 'Rui', whatsapp: '(27) 99999-1111', responsible: true });
    await show(<PagamentoScreen />);
    await fireEvent.press(screen.getByTestId('casas-pagar'));
    expect(await screen.findByTestId('casas-pagamento-erro')).toHaveTextContent('Esse CNPJ já está cadastrado.');
    await fireEvent.press(screen.getByTestId('casas-pagamento-fix'));
    expect(mockReplace).toHaveBeenCalledWith('/casas/vincular/empresa');
  });
});

describe('Painel', () => {
  it('shows the meter, the festas of the month with badges and the subscription row', async () => {
    useCasasDemo.setState((s) => ({
      events: [
        ...s.events,
        { ...s.events[0], id: 'recusada', title: 'Festa recusada', startsAt: at('2026-11-27T23:00:00-03:00'), status: 'rejected', reviewNote: 'Cartaz ilegível' },
      ],
    }));
    await show(<PainelScreen />);
    expect(await screen.findByTestId('casas-painel-nome')).toHaveTextContent('Casa Maré');
    expect(screen.getAllByText('Assinatura ativa').length).toBeGreaterThan(0);
    expect(screen.getByTestId('casas-cota-value')).toHaveTextContent('2 de 4 festas');
    expect(screen.getByTestId('casas-cota').props.accessibilityValue).toMatchObject({ now: 2, max: 4 });
    expect(screen.getByTestId('casas-sobram')).toHaveTextContent('Sobram 2 em Novembro');
    expect(await screen.findByText('Maré Alta: sertanejo')).toBeTruthy();
    expect(screen.getByText('Publicada')).toBeTruthy();
    expect(screen.getByText('Em revisão')).toBeTruthy();
    expect(screen.getByText('Recusada')).toBeTruthy();
    expect(screen.getByText('Cartaz ilegível. Não conta na cota.')).toBeTruthy();
    expect(screen.getByTestId('casas-cadastrar-festa')).toBeEnabled();

    await fireEvent.press(screen.getByLabelText('Dezembro'));
    expect(screen.getByTestId('casas-cota-value')).toHaveTextContent('0 de 4 festas');
    expect(screen.getByText('Nenhuma festa em Dezembro ainda.')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('casas-painel-assinatura-row'));
    expect(mockPush).toHaveBeenCalledWith('/casas/assinatura');
  });

  it('cota cheia: CTA disabled keeping its label, the reason and a shortcut to next month', async () => {
    await fillNovember(2);
    await show(<PainelScreen />);
    expect(await screen.findByTestId('casas-cota-value')).toHaveTextContent('4 de 4 festas');
    const cta = screen.getByTestId('casas-cadastrar-festa');
    expect(cta).toBeDisabled();
    expect(cta).toHaveTextContent('Cadastrar festa');
    expect(screen.getByTestId('casas-painel-nota')).toHaveTextContent('Você já usou as 4 festas de Novembro. Dezembro libera no dia 1º.');
    await fireEvent.press(screen.getByTestId('casas-cadastrar-proximo'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/casas/festa/nova', params: { data: '04/12/2026' } });
  });

  it('past_due: icon + danger text with the deadline, no red button', async () => {
    useCasasDemo.setState((s) => ({
      accounts: s.accounts.map((a) => ({ ...a, subscription: { ...a.subscription!, status: 'past_due' as const } })),
    }));
    await show(<PainelScreen />);
    expect(await screen.findByTestId('casas-past-due')).toHaveTextContent('Não conseguimos cobrar seu cartão. Atualize até 04/12 para manter suas festas.');
    expect(screen.getAllByText('Pagamento atrasado').length).toBeGreaterThan(0);
    // Still inside the paid period: can submit.
    expect(screen.getByTestId('casas-cadastrar-festa')).toBeEnabled();
  });
});

describe('Assinatura', () => {
  it('manage: status, price, next charge and the cancel sheet', async () => {
    await show(<AssinaturaScreen />);
    expect(await screen.findByTestId('casas-gerenciar')).toBeTruthy();
    expect(screen.getByText('Assinatura ativa')).toBeTruthy();
    expect(screen.getByText('R$ 299/mês')).toBeTruthy();
    expect(screen.getByText('04/12/2026')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('casas-trocar-cartao'));
    expect(await screen.findByTestId('casas-assinatura-note')).toHaveTextContent('O portal de pagamento não está disponível nesta versão do app.');
    await fireEvent.press(screen.getByTestId('casas-cancelar'));
    expect(screen.getByText('As festas já publicadas continuam no app.')).toBeTruthy();
    expect(screen.getByText('Depois de 04/12 não dá pra cadastrar festas novas.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('casas-manter'));
    expect(screen.queryByText('As festas já publicadas continuam no app.')).toBeNull();
  });

  it('past_due on the manage screen', async () => {
    useCasasDemo.setState((s) => ({
      accounts: s.accounts.map((a) => ({ ...a, subscription: { ...a.subscription!, status: 'past_due' as const } })),
    }));
    await show(<AssinaturaScreen />);
    expect(await screen.findByTestId('casas-past-due')).toHaveTextContent(/Atualize até 04\/12/);
  });

  it('cancelado: nothing charged, try again', async () => {
    mockParams = { status: 'cancelado' };
    await show(<AssinaturaScreen />);
    expect(await screen.findByText('Pagamento não concluído')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('casas-tentar-de-novo'));
    expect(mockReplace).toHaveBeenCalledWith('/casas/vincular/pagamento');
  });

  it('sucesso while the webhook has not arrived: skeleton and "Confirmando pagamento"', async () => {
    useCasasDemo.setState((s) => ({ accounts: s.accounts.map((a) => ({ ...a, subscription: null })) }));
    mockParams = { status: 'sucesso' };
    await show(<AssinaturaScreen />);
    expect(await screen.findByText('Confirmando pagamento')).toBeTruthy();
    // The webhook lands: the screen follows the store.
    await act(async () => {
      useCasasDemo.setState((s) => ({
        accounts: s.accounts.map((a) => ({ ...a, subscription: { status: 'active', currentPeriodStart: null, currentPeriodEnd: at('2026-12-09T15:00:00Z'), cancelAtPeriodEnd: false } })),
      }));
    });
    expect(await screen.findByTestId('casas-primeira-festa')).toBeTruthy();
  });
});

async function fillFesta(date: string) {
  await fireEvent.changeText(screen.getByTestId('festa-nome'), 'Sexta de Pagode');
  await fireEvent.changeText(screen.getByTestId('festa-data'), date.replace(/\D/g, ''));
  await fireEvent.changeText(screen.getByTestId('festa-fim'), '0400');
  const genre = await screen.findByTestId('festa-genero-pagode-samba');
  await fireEvent.press(genre);
  await fireEvent.press(screen.getByTestId('festa-continuar'));
  await fireEvent.changeText(screen.getByTestId('festa-preco-min'), '30');
  await fireEvent.changeText(screen.getByTestId('festa-link'), 'https://ingressos.example.com/pagode');
  await fireEvent.press(screen.getByTestId('festa-continuar'));
  await fireEvent.press(screen.getByTestId('festa-continuar'));
}

describe('Nova festa', () => {
  it('validates step 1 inline, then submits for review and returns to the panel', async () => {
    await show(<NovaFestaScreen />);
    await screen.findByTestId('festa-nome');
    await fireEvent.press(screen.getByTestId('festa-continuar'));
    expect(screen.getByTestId('festa-nome-error')).toHaveTextContent('Dê um nome de 3 a 120 letras.');
    expect(screen.getByTestId('festa-data-error')).toHaveTextContent('Use o formato DD/MM/AAAA, como 14/11/2026.');

    await fillFesta('27/11/2026');
    expect(screen.getByTestId('festa-previa')).toBeTruthy();
    expect(screen.getByTestId('festa-aviso-cota')).toHaveTextContent('Vai usar 1 das 2 festas que restam em Novembro. Se a revisão recusar, a vaga volta.');
    await fireEvent.press(screen.getByTestId('festa-enviar'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/casas/painel'));
    const ev = useCasasDemo.getState().events.find((e) => e.title === 'Sexta de Pagode')!;
    expect(ev).toMatchObject({ status: 'pending_review', startsAt: '2026-11-28T02:00:00.000Z', endsAt: '2026-11-28T07:00:00.000Z', priceMin: 30 });
  });

  it('blocks a date in a full month before step 2', async () => {
    await fillNovember(2);
    await show(<NovaFestaScreen />);
    await screen.findByTestId('festa-nome');
    await fireEvent.changeText(screen.getByTestId('festa-nome'), 'Sexta de Pagode');
    await fireEvent.changeText(screen.getByTestId('festa-data'), '27112026');
    await fireEvent.press(await screen.findByTestId('festa-genero-pagode-samba'));
    await waitFor(() => expect(screen.getByTestId('festa-continuar')).toBeTruthy());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
    await fireEvent.press(screen.getByTestId('festa-continuar'));
    expect(screen.getByTestId('festa-data-error')).toHaveTextContent('Você já usou as 4 festas de Novembro. Escolha uma data em outro mês.');
  });

  it('quota error from the server on submit goes back to the date with the message', async () => {
    await show(<NovaFestaScreen />);
    await screen.findByTestId('festa-nome');
    await fillFesta('27/11/2026');
    // Another member fills the month while this form is open.
    await act(async () => {
      await fillNovember(2);
    });
    await fireEvent.press(screen.getByTestId('festa-enviar'));
    expect(await screen.findByTestId('festa-data-error')).toHaveTextContent('Você já usou as 4 festas de Novembro. Escolha uma data em outro mês.');
    expect(screen.getByTestId('festa-nota')).toHaveTextContent('Confira os campos marcados.');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('saves a local draft and restores it', async () => {
    const first = await show(<NovaFestaScreen />);
    await screen.findByTestId('festa-nome');
    await fillFesta('27/11/2026');
    await fireEvent.press(screen.getByTestId('festa-rascunho'));
    expect(screen.getByTestId('festa-nota')).toHaveTextContent('Rascunho salvo neste aparelho.');
    await first.unmount();
    await show(<NovaFestaScreen />);
    expect((await screen.findByTestId('festa-nome')).props.value).toBe('Sexta de Pagode');
  });
});

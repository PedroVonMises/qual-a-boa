import '@/ui/testSetup';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Share } from 'react-native';

import { setRepo, SeedRepo } from '@/data';
import { miniDataset, MINI_NOW } from '@/data/__fixtures__/mini';
import type { SeedDataset } from '@/domain/types';
import { ArtistaScreen } from '@/features/artista/ArtistaScreen';
import { CasaScreen } from '@/features/casa/CasaScreen';
import { useFavorites } from '@/state/favorites';
import { estimateLabel, IngressosScreen } from '@/features/ingressos/IngressosScreen';
import { EventoScreen } from '../EventoScreen';
import { isHttpsUrl, mapsUrl, ticketHost, whatsappUrl } from '../linking';
import { inviteMessage } from '../ShareSheet';

const mockPush = jest.fn();
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
}));
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(() => Promise.resolve({ type: 'opened' })) }));
jest.mock('expo-linking', () => ({ createURL: (p: string) => `qualaboa://${p}`, openURL: jest.fn(() => Promise.resolve(true)) }));

const data: SeedDataset = {
  ...miniDataset,
  events: miniDataset.events.map((e) =>
    e.id === 'e01' ? { ...e, ticketUrl: 'https://tickets.example.com/e01' }
    : e.id === 'e02' ? { ...e, ticketUrl: 'http://tickets.example.com/e02' }
    : e.id === 'e08' ? { ...e, ticketUrl: 'https://tickets.example.com/e08' }
    : e,
  ),
};

async function renderWith(ui: React.ReactElement, dataset: SeedDataset = data) {
  setRepo(new SeedRepo(dataset, () => Date.parse(MINI_NOW)));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  useFavorites.setState({ eventIds: [], venueIds: [] });
});

describe('linking helpers', () => {
  it('accepts only https urls', () => {
    expect(isHttpsUrl('https://a.com/x')).toBe(true);
    expect(isHttpsUrl('http://a.com')).toBe(false);
    expect(isHttpsUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpsUrl(undefined)).toBe(false);
  });
  it('names the ticket host and builds a WhatsApp link', () => {
    expect(ticketHost('https://www.Sympla.com.br/evento/1')).toBe('sympla.com.br');
    expect(ticketHost('http://a.com')).toBeNull();
    expect(whatsappUrl('Bora? R$ 30')).toBe('https://wa.me/?text=Bora%3F%20R%24%2030');
  });
  it('builds platform maps urls with encoded names', () => {
    expect(mapsUrl('Bolt & Co', 1, 2, 'ios')).toContain('q=Bolt%20%26%20Co');
    expect(mapsUrl('Bolt', 1, 2, 'android')).toMatch(/^geo:1,2\?q=/);
    expect(mapsUrl('Bolt', 1, 2, 'web')).toContain('google.com/maps');
  });
});

describe('EventoScreen', () => {
  it('goes to the Ingressos step for https tickets', async () => {
    await renderWith(<EventoScreen id="e01" />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Ver ingressos' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/ingressos/[id]', params: { id: 'e01' } });
    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
    expect(screen.getByText('Maiores de 18 anos')).toBeTruthy();
  });

  it('disables tickets for non-https urls', async () => {
    await renderWith(<EventoScreen id="e02" />);
    const btn = await screen.findByRole('button', { name: 'Ingressos indisponíveis' });
    await fireEvent.press(btn);
    expect(WebBrowser.openBrowserAsync).not.toHaveBeenCalled();
    expect(btn).toBeDisabled();
  });

  it('shows the cancelled banner and disables tickets', async () => {
    await renderWith(<EventoScreen id="e08" />);
    expect(await screen.findByText('Evento cancelado')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ingressos indisponíveis' })).toBeDisabled();
  });

  it('shares through the invite sheet and saves', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    await renderWith(<EventoScreen id="e01" />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Compartilhar evento' }));
    expect(await screen.findByTestId('share-sheet')).toBeTruthy();
    expect(screen.getByTestId('share-message').props.value).toMatch(/^Bora no Noite do Funk\?/);
    await fireEvent.press(screen.getByRole('button', { name: 'WhatsApp' }));
    expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining('https://wa.me/?text=Bora%20no%20Noite%20do%20Funk'));
    await fireEvent.press(screen.getByRole('button', { name: 'Mais opções' }));
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ title: 'Noite do Funk', url: 'qualaboa:///evento/e01' }));
    expect(screen.queryByTestId('share-sheet')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar evento' }));
    expect(useFavorites.getState().eventIds).toEqual(['e01']);
  });

  it('shows the venue and event access tags as text badges', async () => {
    await renderWith(<EventoScreen id="e01" />);
    expect(await screen.findByText('Acessível')).toBeTruthy();
    expect(screen.getByText('Opção vegana')).toBeTruthy();
    expect(screen.queryByText('Pet friendly')).toBeNull();
  });

  it('shows an event-level tag at an untagged venue', async () => {
    const tagged: SeedDataset = {
      ...data,
      events: data.events.map((e) => (e.id === 'e03' ? { ...e, accessTags: ['pet-friendly' as const] } : e)),
    };
    await renderWith(<EventoScreen id="e03" />, tagged);
    expect(await screen.findByText('Pet friendly')).toBeTruthy();
    expect(screen.queryByText('Acessível')).toBeNull();
  });

  it('shows not-found for unknown events', async () => {
    await renderWith(<EventoScreen id="nope" />);
    expect(await screen.findByText('Evento não encontrado')).toBeTruthy();
  });
});

describe('IngressosScreen', () => {
  it('estimates the total from the published price', () => {
    expect(estimateLabel(2, 30, 60, false)).toBe('R$ 60,00 a R$ 120,00');
    expect(estimateLabel(3, 20, 20, false)).toBe('R$ 60,00');
    expect(estimateLabel(2, null, null, false)).toBeNull();
    expect(estimateLabel(2, 0, 0, true)).toBeNull();
  });

  it('names the ticket site, adjusts the quantity and hands off to the browser', async () => {
    await renderWith(<IngressosScreen id="e01" />);
    expect(await screen.findByText('A compra termina em tickets.example.com')).toBeTruthy();
    expect(screen.getByTestId('ingressos-estimate')).toHaveTextContent('R$ 60,00 a R$ 120,00');
    await fireEvent.press(screen.getByRole('button', { name: 'Mais um ingresso' }));
    expect(screen.getByTestId('ingressos-qty')).toHaveTextContent('3');
    expect(screen.getByTestId('ingressos-estimate')).toHaveTextContent('R$ 90,00 a R$ 180,00');
    await fireEvent.press(screen.getByRole('button', { name: 'Continuar em tickets.example.com' }));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://tickets.example.com/e01');
  });

  it('never leaves the app for unsafe or cancelled events', async () => {
    await renderWith(<IngressosScreen id="e02" />);
    const btn = await screen.findByRole('button', { name: 'Ingressos indisponíveis' });
    expect(btn).toBeDisabled();
    expect(screen.getByText('Sem link de venda')).toBeTruthy();
  });
});

describe('inviteMessage', () => {
  it('is short and names the venue and price', () => {
    const msg = inviteMessage({ title: 'Noite do Funk', startsAt: '2026-10-24T02:00:00.000Z', priceMin: 30, priceMax: 30, isFree: false }, { name: 'Bolt Club' }, Date.parse(MINI_NOW));
    expect(msg).toBe('Bora no Noite do Funk? Hoje, 23h no Bolt Club. R$ 30. Quem topa?');
  });
});

describe('CasaScreen', () => {
  it('renders past artists and upcoming events for an open venue', async () => {
    await renderWith(<CasaScreen slug="bolt" />);
    expect(await screen.findByText('Já passaram por aqui')).toBeTruthy();
    expect(screen.getAllByText('out/2026').length).toBeGreaterThan(0);
    expect(screen.getByText('Próximos eventos')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Como chegar' })).toBeTruthy();
    expect(screen.queryByText(/ilustrativ/i)).toBeNull();
  });

  it('shows the venue access tags', async () => {
    await renderWith(<CasaScreen slug="bolt" />);
    expect(await screen.findByText('Acessível')).toBeTruthy();
    expect(screen.getByText('Opção vegana')).toBeTruthy();
  });

  it('closed venue hides upcoming events and the CTA', async () => {
    await renderWith(<CasaScreen slug="pub-426" />);
    expect(await screen.findByText('Encerrou as atividades')).toBeTruthy();
    expect(screen.queryByText('Próximos eventos')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Como chegar' })).toBeNull();
  });

  it('flags unverified data', async () => {
    await renderWith(<CasaScreen slug="caipora" />);
    expect(await screen.findByText('Dados não confirmados')).toBeTruthy();
  });

  it('not found', async () => {
    await renderWith(<CasaScreen slug="nada" />);
    expect(await screen.findByText('Casa não encontrada')).toBeTruthy();
  });
});

describe('ArtistaScreen', () => {
  it('lists next show and venues played', async () => {
    await renderWith(<ArtistaScreen slug={miniDataset.artists[0].slug} />);
    expect(await screen.findByText('Próximo show')).toBeTruthy();
    expect(screen.getByText('Já tocou em')).toBeTruthy();
  });
});

import '@/ui/testSetup';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';
import { Share } from 'react-native';

import { setRepo, SeedRepo } from '@/data';
import { miniDataset, MINI_NOW } from '@/data/__fixtures__/mini';
import type { SeedDataset } from '@/domain/types';
import { ArtistaScreen } from '@/features/artista/ArtistaScreen';
import { CasaScreen } from '@/features/casa/CasaScreen';
import { useFavorites } from '@/state/favorites';
import { EventoScreen } from '../EventoScreen';
import { isHttpsUrl, mapsUrl } from '../linking';

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

async function renderWith(ui: React.ReactElement) {
  setRepo(new SeedRepo(data, () => Date.parse(MINI_NOW)));
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
  it('builds platform maps urls with encoded names', () => {
    expect(mapsUrl('Bolt & Co', 1, 2, 'ios')).toContain('q=Bolt%20%26%20Co');
    expect(mapsUrl('Bolt', 1, 2, 'android')).toMatch(/^geo:1,2\?q=/);
    expect(mapsUrl('Bolt', 1, 2, 'web')).toContain('google.com/maps');
  });
});

describe('EventoScreen', () => {
  it('opens the browser for https tickets', async () => {
    await renderWith(<EventoScreen id="e01" />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Ver ingressos' }));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://tickets.example.com/e01');
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

  it('shares and saves', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    await renderWith(<EventoScreen id="e01" />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Compartilhar evento' }));
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ title: 'Noite do Funk', url: 'qualaboa:///evento/e01' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar evento' }));
    expect(useFavorites.getState().eventIds).toEqual(['e01']);
  });

  it('shows not-found for unknown events', async () => {
    await renderWith(<EventoScreen id="nope" />);
    expect(await screen.findByText('Evento não encontrado')).toBeTruthy();
  });
});

describe('CasaScreen', () => {
  it('renders past artists and upcoming events for an open venue', async () => {
    await renderWith(<CasaScreen slug="bolt" />);
    expect(await screen.findByText('Já passaram por aqui')).toBeTruthy();
    expect(screen.getAllByText('out/2026').length).toBeGreaterThan(0);
    expect(screen.getByText('Próximos eventos')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Como chegar' })).toBeTruthy();
    expect(screen.getAllByText('Exemplo ilustrativo').length).toBeGreaterThanOrEqual(1);
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

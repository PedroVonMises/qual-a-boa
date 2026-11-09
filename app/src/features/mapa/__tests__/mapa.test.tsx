import '@/ui/testSetup';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { BackHandler, Platform } from 'react-native';
import type { ReactNode } from 'react';

import { SeedRepo, setRepo } from '@/data';
import { MINI_NOW, miniDataset } from '@/data/__fixtures__/mini';
import type { SearchItem } from '@/domain/types';
import { useFilters } from '@/state/filters';
import { useLocation } from '@/state/location';
import { MapaScreen } from '../MapaScreen';
import { useMapSheet } from '../mapSheetStore';
import { VenueMap as WebMap } from '../VenueMap.web';
import { groupByVenue } from '../pins';

const mockPush = jest.fn();
const mockNavigate = jest.fn();
let mockLarge = false;
let mockMapProps: { radiusKm?: number; bottomInset?: number; onLocate?: () => void } = {};

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return {
    useRouter: () => ({ push: mockPush, navigate: mockNavigate }),
    useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]),
  };
});
jest.mock('@/ui/useBreakpoint', () => ({
  useBreakpoint: () => ({ isLarge: mockLarge, gutter: 16, breakpoint: mockLarge ? 'lg' : 'sm', width: mockLarge ? 1280 : 390, height: 844 }),
}));
jest.mock('../VenueMap', () => {
  const { Pressable, Text } = require('react-native');
  return {
    VenueMap: ({ pins, onSelect, ...rest }: { pins: { venue: { id: string; name: string } }[]; onSelect: (id: string) => void }) => (
      (mockMapProps = rest),
      <>
        {pins.map((p) => (
          <Pressable key={p.venue.id} accessibilityRole="button" accessibilityLabel={`pin ${p.venue.name}`} onPress={() => onSelect(p.venue.id)}>
            <Text>{p.venue.name}</Text>
          </Pressable>
        ))}
      </>
    ),
  };
});

const venueOf = (id: string) => miniDataset.venues.find((v) => v.id === id)!;
const itemsFor = (...eventIds: string[]): SearchItem[] =>
  eventIds.map((id) => {
    const event = miniDataset.events.find((e) => e.id === id)!;
    return { event, venue: venueOf(event.venueId), distanceKm: 1 };
  });

function wrap(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
}

beforeEach(() => {
  mockPush.mockClear();
  mockNavigate.mockClear();
  mockLarge = false;
  mockMapProps = {};
  useMapSheet.setState({ index: 1 });
  useFilters.getState().reset();
  useLocation.getState().resetLocation();
  setRepo(new SeedRepo(miniDataset, () => Date.parse(MINI_NOW)));
});

describe('groupByVenue', () => {
  it('makes one pin per venue and drops closed venues and cancelled events', () => {
    const pins = groupByVenue(itemsFor('e01', 'e04', 'e02', 'e07', 'e08'));
    expect(pins.map((p) => p.venue.slug)).toEqual(['bolt', 'selva']);
    expect(pins[0].items.map((i) => i.event.id)).toEqual(['e01', 'e04']);
  });
});

describe('VenueMap.web', () => {
  it('renders accessible, tappable pins and neighborhood labels', async () => {
    const onSelect = jest.fn();
    const pins = groupByVenue(itemsFor('e01', 'e02'));
    await render(<WebMap pins={pins} selectedId="v1" onSelect={onSelect} center={{ lat: -20.29, lng: -40.29, label: 'x' }} />);
    expect(screen.getByRole('button', { name: 'Bolt Club, 1 evento' })).toBeSelected();
    expect(screen.getByText('PRAIA DO CANTO')).toBeTruthy();
    expect(screen.getByText('VILA VELHA')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Selva Bar, 1 evento' }));
    expect(onSelect).toHaveBeenCalledWith('v2');
  });
});

describe('MapaScreen', () => {
  it('lists open venues, hides closed ones and filters by selected pin', async () => {
    await render(wrap(<MapaScreen now={MINI_NOW} />));
    expect(await screen.findByText('Noite do Funk')).toBeTruthy();
    expect(screen.getByText('Nesta área')).toBeTruthy();
    expect(screen.queryByText('Noite do Pub')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'pin Selva Bar' }));
    expect(screen.queryByText('Noite do Funk')).toBeNull();
    expect(screen.getByText('Pagode da Selva')).toBeTruthy();
  });

  it('navigates to the event, the venue and filters', async () => {
    await render(wrap(<MapaScreen now={MINI_NOW} />));
    await screen.findByText('Noite do Funk');
    await fireEvent.press(screen.getByRole('button', { name: /^Noite do Funk/ }));
    expect(mockPush).toHaveBeenCalledWith('/evento/e01');
    await fireEvent.press(screen.getByRole('link', { name: 'Ver casa Bolt Club' }));
    expect(mockPush).toHaveBeenCalledWith('/casa/bolt');
    await fireEvent.press(screen.getByRole('button', { name: 'Filtros' }));
    expect(mockPush).toHaveBeenCalledWith('/filtros');
  });

  it('shows an error state with retry', async () => {
    setRepo({
      searchEvents: () => Promise.reject(new Error('boom')),
    } as never);
    await render(wrap(<MapaScreen now={MINI_NOW} />));
    expect(await screen.findByText('Tentar de novo')).toBeTruthy();
  });

  it('uses the side-by-side split at large widths', async () => {
    mockLarge = true;
    await render(wrap(<MapaScreen now={MINI_NOW} />));
    expect(screen.getByTestId('mapa-split')).toBeTruthy();
    expect(screen.queryByTestId('mapa-sheet')).toBeNull();
  });

  it('goes back to Início with the back button', async () => {
    await render(wrap(<MapaScreen now={MINI_NOW} />));
    await screen.findByText('Noite do Funk');
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar para o Início' }));
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('searches exactly the chosen radius (no 25 km minimum) and draws it on the map', async () => {
    useLocation.getState().setLocation({ lat: -20.299, lng: -40.295, label: 'Praia do Canto' });
    await render(wrap(<MapaScreen now={MINI_NOW} />));
    expect(await screen.findByText('Rock na Praia')).toBeTruthy(); // ~4.5 km away, inside the default 10 km
    await fireEvent.press(screen.getByRole('button', { name: 'Até 3 km' }));
    expect(useFilters.getState().filters.radiusKm).toBe(3);
    await waitFor(() => expect(screen.queryByText('Rock na Praia')).toBeNull());
    expect(screen.getByText('Noite do Funk')).toBeTruthy();
    expect(mockMapProps.radiusKm).toBe(3);
  });

  it('offers the next radius when nothing is around', async () => {
    useLocation.getState().setLocation({ lat: -20.31, lng: -40.31, label: 'x' });
    useFilters.getState().set({ radiusKm: 1 });
    await render(wrap(<MapaScreen now={MINI_NOW} />));
    expect(await screen.findByText('Nenhuma casa aberta por aqui')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Aumente o raio para 3 km' }));
    expect(useFilters.getState().filters.radiusKm).toBe(3);
    expect(await screen.findByText('Noite do Funk')).toBeTruthy();
  });
});

describe('MapaScreen sheet', () => {
  const handle = () => screen.getByRole('adjustable', { name: 'Tamanho da lista' });

  it('opens split; pills switch between full map and full list', async () => {
    await render(wrap(<MapaScreen now={MINI_NOW} />));
    await screen.findByText('Noite do Funk');
    expect(screen.getByTestId('mapa-sheet')).toBeTruthy();
    expect(handle().props.accessibilityValue).toEqual({ text: 'Dividido' });
    expect(screen.queryByTestId('mapa-pill')).toBeNull();

    await act(async () => useMapSheet.getState().setIndex(0));
    await fireEvent.press(screen.getByRole('button', { name: 'Ver lista' }));
    expect(useMapSheet.getState().index).toBe(2);
    expect(handle().props.accessibilityValue).toEqual({ text: 'Lista cheia' });
    // Full list: the floating row is hidden and the search row sits at the top of the sheet (one of each control).
    expect(screen.getAllByRole('button', { name: 'Voltar para o Início' })).toHaveLength(1);
    expect(mockMapProps.onLocate).toBeUndefined();

    await fireEvent.press(screen.getByRole('button', { name: 'Ver mapa' }));
    expect(useMapSheet.getState().index).toBe(0);
    expect(screen.getByRole('button', { name: 'Ver lista' })).toBeTruthy();
  });

  it('handle: increment/decrement step the state and a tap toggles it', async () => {
    await render(wrap(<MapaScreen now={MINI_NOW} />));
    await screen.findByText('Noite do Funk');
    await fireEvent(handle(), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(useMapSheet.getState().index).toBe(2);
    await fireEvent(handle(), 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(useMapSheet.getState().index).toBe(2);
    await fireEvent(handle(), 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    await fireEvent(handle(), 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(handle().props.accessibilityValue).toEqual({ text: 'Mapa cheio' });
    await fireEvent.press(handle());
    expect(useMapSheet.getState().index).toBe(1);
    await fireEvent.press(handle());
    expect(useMapSheet.getState().index).toBe(2);
    await fireEvent.press(handle());
    expect(useMapSheet.getState().index).toBe(1);
  });

  it('selecting a pin on the full map raises the sheet to split', async () => {
    useMapSheet.setState({ index: 0 });
    await render(wrap(<MapaScreen now={MINI_NOW} />));
    await fireEvent.press(await screen.findByRole('button', { name: 'pin Selva Bar' }));
    expect(useMapSheet.getState().index).toBe(1);
  });

  it('passes the sheet height to the map as its bottom inset', async () => {
    await render(wrap(<MapaScreen now={MINI_NOW} />));
    await screen.findByText('Noite do Funk');
    const split = mockMapProps.bottomInset!;
    expect(split).toBeGreaterThan(88);
    await act(async () => useMapSheet.getState().setIndex(0));
    expect(mockMapProps.bottomInset).toBe(88);
  });

  it('Android back: full list steps back to split, then goes to Início', async () => {
    const listeners: (() => boolean)[] = [];
    const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_e, fn) => {
      listeners.push(fn as () => boolean);
      return { remove: () => {} };
    });
    const restore = jest.replaceProperty(Platform, 'OS', 'android');
    useMapSheet.setState({ index: 2 });
    await render(wrap(<MapaScreen now={MINI_NOW} />));
    await screen.findByText('Noite do Funk');
    const back = listeners[listeners.length - 1];
    let consumed = false;
    await act(async () => {
      consumed = back();
    });
    expect(consumed).toBe(true);
    expect(useMapSheet.getState().index).toBe(1);
    expect(mockNavigate).not.toHaveBeenCalled();
    await act(async () => {
      consumed = back();
    });
    expect(consumed).toBe(true);
    expect(mockNavigate).toHaveBeenCalledWith('/');
    restore.restore();
    spy.mockRestore();
  });
});

describe('MapaScreen large', () => {
  it('back button heads the list column; hide list / list only toggle and revert', async () => {
    mockLarge = true;
    await render(wrap(<MapaScreen now={MINI_NOW} />));
    await screen.findByText('Noite do Funk');
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar para o Início' }));
    expect(mockNavigate).toHaveBeenCalledWith('/');

    await fireEvent.press(screen.getByRole('button', { name: 'Ocultar lista' }));
    expect(screen.queryByTestId('mapa-column')).toBeNull();
    expect(screen.getByRole('button', { name: 'pin Bolt Club' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Mostrar lista' }));
    expect(screen.getByTestId('mapa-column')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Só lista' }));
    expect(screen.queryByRole('button', { name: 'pin Bolt Club' })).toBeNull();
    expect(screen.getByText('Noite do Funk')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Mostrar mapa' }));
    expect(screen.getByRole('button', { name: 'pin Bolt Club' })).toBeTruthy();
    expect(screen.getByTestId('mapa-split')).toBeTruthy();
  });
});

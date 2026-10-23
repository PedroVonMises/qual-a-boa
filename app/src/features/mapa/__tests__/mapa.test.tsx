import '@/ui/testSetup';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { SeedRepo, setRepo } from '@/data';
import { MINI_NOW, miniDataset } from '@/data/__fixtures__/mini';
import type { SearchItem } from '@/domain/types';
import { MapaScreen } from '../MapaScreen';
import { VenueMap as WebMap } from '../VenueMap.web';
import { groupByVenue } from '../pins';

const mockPush = jest.fn();
let mockLarge = false;

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('react-native-maps', () => ({ __esModule: true, default: 'MapView', Marker: 'Marker' }));
jest.mock('@/ui/useBreakpoint', () => ({ useBreakpoint: () => ({ isLarge: mockLarge, gutter: 16, breakpoint: 'sm' }) }));
jest.mock('../VenueMap', () => {
  const { Pressable, Text } = require('react-native');
  return {
    VenueMap: ({ pins, onSelect }: { pins: { venue: { id: string; name: string } }[]; onSelect: (id: string) => void }) => (
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
  mockLarge = false;
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
});

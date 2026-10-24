import '@/ui/testSetup';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { MINI_NOW, miniDataset } from '@/data/__fixtures__/mini';
import type { SearchItem } from '@/domain/types';
import { VenueMap } from '../VenueMap';
import { groupByVenue, pinLabel } from '../pins';
import { ATTRIBUTION } from '../mapConfig';

// Latest props given to the mocked <Map>, so tests can trigger its callbacks.
let mockMapProps: { onDidFailLoadingMap?: () => void; onDidFinishLoadingStyle?: () => void } = {};

jest.mock('@maplibre/maplibre-react-native', () => {
  const { View, Pressable } = require('react-native');
  return {
    Map: (props: { children?: unknown }) => {
      mockMapProps = props as typeof mockMapProps;
      return <View testID="maplibre-map">{props.children as never}</View>;
    },
    Camera: () => null,
    Marker: ({ children, onPress, id }: { children: never; onPress?: () => void; id?: string }) => (
      <Pressable testID={`marker-${id}`} onPress={onPress}>
        {children}
      </Pressable>
    ),
  };
});

const venueOf = (id: string) => miniDataset.venues.find((v) => v.id === id)!;
const itemsFor = (...eventIds: string[]): SearchItem[] =>
  eventIds.map((id) => {
    const event = miniDataset.events.find((e) => e.id === id)!;
    return { event, venue: venueOf(event.venueId), distanceKm: 1 };
  });

const pins = groupByVenue(itemsFor('e01', 'e04', 'e02'));
const center = { lat: -20.3, lng: -40.3, label: 'x' };
const base = { pins, selectedId: null, onSelect: () => {}, center };

describe('VenueMap (native, MapLibre)', () => {
  beforeEach(() => {
    mockMapProps = {};
    jest.useFakeTimers().setSystemTime(Date.parse(MINI_NOW));
  });
  afterEach(() => jest.useRealTimers());

  it('renders the map with the visible attribution and one accessible marker per venue', async () => {
    await render(<VenueMap {...base} />);
    expect(screen.getByTestId('maplibre-map')).toBeTruthy();
    expect(screen.getByText(ATTRIBUTION)).toBeTruthy();
    for (const pin of pins) expect(screen.getByLabelText(pinLabel(pin))).toBeTruthy();
  });

  it('reports the pressed venue', async () => {
    const onSelect = jest.fn();
    await render(<VenueMap {...base} onSelect={onSelect} />);
    await fireEvent.press(screen.getByTestId(`marker-${pins[1].venue.id}`));
    expect(onSelect).toHaveBeenCalledWith(pins[1].venue.id);
  });

  it('shows the locate button only when onLocate is given', async () => {
    const { rerender } = await render(<VenueMap {...base} />);
    expect(screen.queryByLabelText('Minha localização')).toBeNull();
    const onLocate = jest.fn();
    await rerender(<VenueMap {...base} onLocate={onLocate} />);
    await fireEvent.press(screen.getByLabelText('Minha localização'));
    expect(onLocate).toHaveBeenCalledTimes(1);
  });

  it('marks the selected pin with a check icon, not just a color', async () => {
    const { rerender } = await render(<VenueMap {...base} />);
    expect(screen.queryByTestId('icon-check', { includeHiddenElements: true })).toBeNull();
    await rerender(<VenueMap {...base} selectedId={pins[0].venue.id} />);
    expect(screen.getAllByTestId('icon-check', { includeHiddenElements: true })).toHaveLength(1);
    expect(screen.getByLabelText(pinLabel(pins[0])).props.accessibilityState).toEqual({ selected: true });
  });

  it('shows a badge from rank and recommended', async () => {
    const ranked = [{ ...pins[0], rank: 1 }, { ...pins[1], recommended: true }];
    await render(<VenueMap {...base} pins={ranked} />);
    expect(screen.getAllByTestId('pin-badge')).toHaveLength(2);
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('falls back to the schematic map with a note when the style fails to load', async () => {
    await render(<VenueMap {...base} />);
    await act(async () => mockMapProps.onDidFailLoadingMap?.());
    expect(screen.queryByTestId('maplibre-map')).toBeNull();
    expect(screen.getByLabelText('Mapa esquemático de casas abertas')).toBeTruthy();
    expect(screen.getByText('Mapa simplificado (sem conexão com os mapas)')).toBeTruthy();
    expect(screen.getByLabelText(pinLabel(pins[0]))).toBeTruthy();
  });

  it('falls back when the style never finishes loading', async () => {
    await render(<VenueMap {...base} />);
    await act(async () => {
      jest.advanceTimersByTime(16000);
    });
    expect(screen.getByText('Mapa simplificado (sem conexão com os mapas)')).toBeTruthy();
  });

  it('keeps the map when the style loads in time', async () => {
    await render(<VenueMap {...base} />);
    await act(async () => {
      mockMapProps.onDidFinishLoadingStyle?.();
      jest.advanceTimersByTime(16000);
    });
    expect(screen.getByTestId('maplibre-map')).toBeTruthy();
  });
});

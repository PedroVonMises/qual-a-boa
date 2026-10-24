import '@/ui/testSetup';
import { render, screen } from '@testing-library/react-native';

import { miniDataset } from '@/data/__fixtures__/mini';
import { VenueMap } from '../VenueMap';
import { groupByVenue, pinLabel } from '../pins';

// Jest / Expo Go: the MapLibre native module cannot be loaded.
jest.mock('@maplibre/maplibre-react-native', () => {
  throw new Error('MapLibre native module is not available');
});

it('renders the schematic map with the note instead of a blank view', async () => {
  const items = miniDataset.events.slice(0, 3).map((event) => ({
    event,
    venue: miniDataset.venues.find((v) => v.id === event.venueId)!,
    distanceKm: 1,
  }));
  const pins = groupByVenue(items);
  await render(<VenueMap pins={pins} selectedId={null} onSelect={() => {}} center={{ lat: -20.3, lng: -40.3, label: 'x' }} />);
  expect(screen.getByLabelText('Mapa esquemático de casas abertas')).toBeTruthy();
  expect(screen.getByText('Mapa simplificado (sem conexão com os mapas)')).toBeTruthy();
  expect(pins.length).toBeGreaterThan(0);
  expect(screen.getByLabelText(pinLabel(pins[0]))).toBeTruthy();
});

import '@/ui/testSetup';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { SeedRepo, setRepo } from '@/data';
import seedData from '@/data/seed.json';
import { filtersToUrlParams, urlParamsToFilters } from '@/domain/filters';
import type { SeedDataset } from '@/domain/types';
import { CasaScreen } from '@/features/casa/CasaScreen';
import { EventoScreen } from '@/features/evento/EventoScreen';
import { capSchematicPins, pinsToGeoJson } from '@/features/mapa/clustering';
import { groupByVenue } from '@/features/mapa/pins';
import { ErrorScreen } from '@/shell/CrashNotice';
import { useFilters } from '@/state/filters';
import { ThemeProvider } from '@/theme/ThemeProvider';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a), back: () => mockBack(), canGoBack: () => true, replace: (...a: unknown[]) => mockReplace(...a) },
  useRouter: () => ({ push: mockPush, back: mockBack, canGoBack: () => true, replace: mockReplace }),
  useLocalSearchParams: () => ({}),
}));

const dataset = seedData as unknown as SeedDataset;

function wrap(ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <ThemeProvider mode="dark">
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </ThemeProvider>
  );
}

beforeEach(() => {
  mockPush.mockClear();
  mockBack.mockClear();
  mockReplace.mockClear();
  useFilters.getState().reset();
  setRepo(new SeedRepo(dataset, () => Date.parse(dataset.generatedAt)));
});

describe('Phase 3 end-to-end discovery & UX polish', () => {
  it('preserves combined filter state and round-trips shareable URL params', () => {
    const store = useFilters.getState();
    store.toggleGenre('funk');
    store.toggleGenre('eletronica-house');
    store.set({ priceMax: 40, area: 'Praia do Canto', sort: 'price', query: 'baile' });

    const current = useFilters.getState().filters;
    expect(current.genreSlugs).toEqual(['funk', 'eletronica-house']);
    expect(current.priceMax).toBe(40);
    expect(current.area).toBe('Praia do Canto');
    expect(current.sort).toBe('price');
    expect(current.query).toBe('baile');

    const urlParams = filtersToUrlParams(current);
    const hydrated = urlParamsToFilters(urlParams);
    expect(hydrated).toEqual(current);
  });

  it('clusters 200+ venues cleanly into GeoJSON and caps schematic pins while keeping selectedId', async () => {
    const repo = new SeedRepo(dataset, () => Date.parse(dataset.generatedAt));
    const page = await repo.searchEvents({
      lat: -20.2976,
      lng: -40.2958,
      radiusKm: 50,
      sort: 'date',
      limit: 500,
      now: dataset.generatedAt,
    });
    const pins = groupByVenue(page.items);
    expect(pins.length).toBeGreaterThanOrEqual(200);

    const lastPin = pins[pins.length - 1];
    const geojson = pinsToGeoJson(pins, lastPin.venue.id);
    expect(geojson.type).toBe('FeatureCollection');
    expect(geojson.features.length).toBe(pins.length);
    const selectedFeature = geojson.features.find((f) => f.properties.id === lastPin.venue.id);
    expect(selectedFeature?.properties.selected).toBe(true);

    const capped = capSchematicPins(pins, lastPin.venue.id, 28);
    expect(capped).toHaveLength(28);
    expect(capped.some((p) => p.venue.id === lastPin.venue.id)).toBe(true);
  });

  it('renders /casa/[slug] with priceRange, genres, and shareable link action', async () => {
    await render(wrap(<CasaScreen slug="bolt" />));
    expect(await screen.findByRole('header', { name: 'Bolt' })).toBeTruthy();
    expect(screen.getByText(/Faixa \$\$/)).toBeTruthy();
    expect(screen.getByTestId('casa-share')).toBeTruthy();
  });

  it('renders /evento/[id] cleanly for a seeded catalog event', async () => {
    const firstUpcoming = dataset.events.find((e) => e.status === 'published' && Date.parse(e.startsAt) >= Date.parse(dataset.generatedAt))!;
    await render(wrap(<EventoScreen id={firstUpcoming.id} />));
    expect(await screen.findByText(firstUpcoming.title)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Compartilhar evento' })).toBeTruthy();
  });

  it('ErrorScreen displays friendly error copy without leaking raw stack traces', async () => {
    const retry = jest.fn();
    const err = new Error('SECRET_DB_PASSWORD_LEAK');
    err.stack = 'Error: SECRET_DB_PASSWORD_LEAK\n    at internalFunction (/srv/secret/file.ts:42:10)';
    await render(<ErrorScreen error={err} retry={retry} />);
    expect(screen.getByText('Ops! Algo deu errado por aqui')).toBeTruthy();
    expect(screen.queryByText(/SECRET_DB_PASSWORD_LEAK/)).toBeNull();
    expect(screen.queryByText(/internalFunction/)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { setRepo, SeedRepo } from '@/data';
import { miniDataset, MINI_NOW } from '@/data/__fixtures__/mini';
import { useFavorites } from '@/state/favorites';
import { useFilters } from '@/state/filters';
import { clock } from './clock';

/** Fresh seed repo, frozen clock and empty stores; returns a renderer wrapped in a QueryClientProvider. */
export function setupFeatureTest() {
  setRepo(new SeedRepo(miniDataset));
  clock.now = () => Date.parse(MINI_NOW);
  useFilters.getState().reset();
  useFavorites.setState({ eventIds: [], venueIds: [] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return (ui: ReactElement) => render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

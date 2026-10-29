import '@/ui/testSetup';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';

import { ContaScreen } from '../ContaScreen';

jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn(), back: jest.fn(), push: jest.fn() }) }));
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
// Seed-data build: there is no backend to hold an account.
jest.mock('@/lib/env', () => ({ env: { dataSource: 'seed', supabaseUrl: '', supabaseAnonKey: '', demoTools: false } }));

it('explains that accounts are unavailable on a seed-data build and offers no destructive controls', async () => {
  await render(
    <QueryClientProvider client={new QueryClient()}>
      <ContaScreen />
    </QueryClientProvider>,
  );
  expect(screen.getByText('Conta indisponível')).toBeTruthy();
  expect(screen.queryByTestId('conta-apagar')).toBeNull();
});

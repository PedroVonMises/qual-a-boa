import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '@/theme/ThemeProvider';
import { palette } from '@/theme/tokens';

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000, gcTime: 10 * 60_000, retry: 1, refetchOnWindowFocus: false },
      mutations: { retry: 0 },
    },
  });
}

/**
 * Hook for a future light theme. The app is dark-first: always 'dark' for now.
 * TODO(orchestrator): read the system scheme / user preference here (see ThemeProvider).
 */
export function useShellScheme(): 'dark' | 'light' {
  return 'dark';
}

/** All app-wide providers. The orchestrator adds `@/theme/ThemeProvider` inside SafeAreaProvider. */
export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(createAppQueryClient);
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider mode="dark">
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: palette.night } });

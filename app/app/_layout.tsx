import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { useRemoteSync } from '@/data/sync';
import { AppProviders } from '@/shell/AppProviders';
import { SessionGuard } from '@/shell/SessionGuard';
import { SplashOverlay } from '@/shell/SplashOverlay';
import { useSession } from '@/state/session';
import { fontMap } from '@/theme/fonts';
import { palette } from '@/theme/tokens';

// Keep the native splash up until fonts load; the in-app SplashOverlay then takes over.
SplashScreen.preventAutoHideAsync().catch(() => {});

export const unstable_settings = { initialRouteName: '(tabs)' };

export default function RootLayout() {
  useRemoteSync();
  const [fontsLoaded, fontError] = useFonts(fontMap);
  const hydrated = useSession((s) => s.hydrated);
  const ready = (fontsLoaded || !!fontError) && hydrated;
  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  return (
    <AppProviders>
      <StatusBar style="light" />
      {fontsLoaded || fontError ? (
        <>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.night } }}>
            <Stack.Screen name="filtros" options={{ presentation: 'modal' }} />
          </Stack>
          <SessionGuard />
        </>
      ) : null}
      <SplashOverlay ready={ready} />
    </AppProviders>
  );
}

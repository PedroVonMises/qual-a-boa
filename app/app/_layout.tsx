import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useRemoteSync } from '@/data/sync';
import { useLocationRefresh } from '@/lib/location';
import { installCrashReporter } from '@/lib/crashReport';
import { CrashNotice, ErrorScreen } from '@/shell/CrashNotice';
import { AppProviders } from '@/shell/AppProviders';
import { OfflineBanner } from '@/shell/OfflineBanner';
import { SessionGuard } from '@/shell/SessionGuard';
import { SplashOverlay } from '@/shell/SplashOverlay';
import { useSession } from '@/state/session';
import { fontMap } from '@/theme/fonts';
import { palette } from '@/theme/tokens';

// Keep the native splash up until fonts load; the in-app SplashOverlay then takes over.
SplashScreen.preventAutoHideAsync().catch(() => {});
// Native only: on web expo-router's lazy route loader throws a harmless 'Requiring unknown module' before retrying,
// and the browser console already has everything else.
if (Platform.OS !== 'web') installCrashReporter();

// Render errors in any screen land here instead of closing the app.
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return <ErrorScreen error={error} retry={retry} />;
}

export const unstable_settings = { initialRouteName: '(tabs)' };

export default function RootLayout() {
  useRemoteSync();
  useLocationRefresh();
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
          <OfflineBanner />
        </>
      ) : null}
      <SplashOverlay ready={ready} />
      <CrashNotice />
    </AppProviders>
  );
}

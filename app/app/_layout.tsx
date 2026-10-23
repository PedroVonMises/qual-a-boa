import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { palette } from '@/theme/tokens';

// Wave 0 stub. The Shell agent (Wave 1-D) replaces this with providers, fonts, age gate and splash.
export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palette.night } }} />
    </>
  );
}

import { Tabs } from 'expo-router';
import { useWindowDimensions } from 'react-native';

import { breakpoints, fonts, palette } from '@/theme/tokens';
import { TabBar } from '@/ui';

// Narrow screens use the design-system TabBar (3px top indicator, 64px + safe area).
// Wide screens (>= 1024) keep the default side rail, styled with tokens below.
export default function TabLayout() {
  const { width } = useWindowDimensions();
  const wide = width >= breakpoints.lg;
  return (
    <Tabs
      tabBar={wide ? undefined : (props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarPosition: wide ? 'left' : 'bottom',
        tabBarActiveTintColor: palette.riotPink,
        tabBarInactiveTintColor: palette.dusk,
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium },
        tabBarStyle: {
          backgroundColor: palette.soot,
          borderColor: palette.hairline,
          borderTopColor: palette.hairline,
          borderRightColor: palette.hairline,
        },
        sceneStyle: { backgroundColor: palette.night },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Explorar' }} />
      <Tabs.Screen name="mapa" options={{ title: 'Mapa' }} />
      <Tabs.Screen name="salvos" options={{ title: 'Salvos' }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}

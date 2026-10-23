import { Tabs } from 'expo-router';
import { useWindowDimensions } from 'react-native';

import { breakpoints, fonts, palette } from '@/theme/tokens';

// TODO(orchestrator): pass `tabBar={(props) => <TabBar {...props} />}` from @/ui to replace the
// default bar (adds the 3px top indicator and 64px height + safe area). Keep tabBarPosition logic.
export default function TabLayout() {
  const { width } = useWindowDimensions();
  const wide = width >= breakpoints.lg;
  return (
    <Tabs
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

import { Tabs } from 'expo-router';

import { palette } from '@/theme/tokens';

// Wave 0 stub. The Shell agent replaces tab bar styling with ui/TabBar.
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.riotPink,
        tabBarInactiveTintColor: palette.dusk,
        tabBarStyle: { backgroundColor: palette.soot, borderTopColor: palette.hairline },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Explorar' }} />
      <Tabs.Screen name="mapa" options={{ title: 'Mapa' }} />
      <Tabs.Screen name="salvos" options={{ title: 'Salvos' }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}

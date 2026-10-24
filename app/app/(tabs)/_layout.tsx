import { Tabs } from 'expo-router';
import { useWindowDimensions, type ColorValue } from 'react-native';

import { breakpoints, fonts, palette } from '@/theme/tokens';
import { Icon, TabBar, type IconName } from '@/ui';

const icon = (name: IconName) =>
  function TabIcon({ color }: { color: ColorValue }) {
    return <Icon name={name} size={22} color={String(color)} />;
  };

// Narrow screens use the design-system TabBar (3px top indicator, 64px + safe area).
// Wide screens (>= 1024) use the same TabBar as a 240px side rail with the logo mark on top.
export default function TabLayout() {
  const { width } = useWindowDimensions();
  const wide = width >= breakpoints.lg;
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} variant={wide ? 'rail' : 'bottom'} />}
      screenOptions={{
        headerShown: false,
        tabBarPosition: wide ? 'left' : 'bottom',
        tabBarActiveTintColor: palette.riotPink,
        tabBarInactiveTintColor: palette.dusk,
        tabBarActiveBackgroundColor: palette.ash,
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 14 },
        tabBarItemStyle: { borderRadius: 14, minHeight: 48 },
        tabBarStyle: {
          backgroundColor: palette.soot,
          borderColor: palette.hairline,
          borderTopColor: palette.hairline,
          borderRightColor: palette.hairline,
        },
        sceneStyle: { backgroundColor: palette.night },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Explorar', tabBarIcon: icon('compass') }} />
      <Tabs.Screen name="mapa" options={{ title: 'Mapa', tabBarIcon: icon('map') }} />
      <Tabs.Screen name="salvos" options={{ title: 'Salvos', tabBarIcon: icon('bookmark') }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: icon('user') }} />
    </Tabs>
  );
}

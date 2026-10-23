import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { fonts, type } from '@/theme/tokens';
import { Icon, type IconName } from './Icon';
import { lightHaptic } from './haptics';
import { Text } from './Text';
import { useInsets } from './useInsets';

/** Structural subset of React Navigation's BottomTabBarProps (so no extra dependency is needed). */
export interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  descriptors: Record<string, { options: { title?: string; tabBarAccessibilityLabel?: string } }>;
  navigation: {
    emit: (event: any) => { defaultPrevented: boolean };
    navigate: (...args: any[]) => void;
  };
  /** Route name to icon. Defaults cover index/explorar, mapa, salvos, perfil. */
  icons?: Record<string, IconName>;
}

const DEFAULT_ICONS: Record<string, IconName> = {
  index: 'compass',
  explorar: 'compass',
  mapa: 'map',
  salvos: 'bookmark',
  perfil: 'user',
};

export const TAB_BAR_HEIGHT = 64;

/** Custom bar for expo-router Tabs: 64px + safe area, active = pink + 3px top indicator + selected state. */
export function TabBar({ state, descriptors, navigation, icons }: TabBarProps) {
  const { colors } = useTheme();
  const insets = useInsets();
  const map = { ...DEFAULT_ICONS, ...icons };
  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        { height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom, backgroundColor: colors.surface, borderTopColor: colors.border },
      ]}>
      {state.routes.map((route, i) => {
        const focused = state.index === i;
        const { options } = descriptors[route.key] ?? { options: {} };
        const label = options.title ?? route.name;
        const color = focused ? colors.accent : colors.textMuted;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            lightHaptic();
            navigation.navigate(route.name);
          }
        };
        const webProps = Platform.OS === 'web' ? ({ 'aria-current': focused ? 'page' : undefined } as object) : {};
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
            accessibilityState={{ selected: focused }}
            onPress={onPress}
            style={styles.tab}
            {...webProps}>
            {focused ? <View testID="tab-indicator" style={[styles.indicator, { backgroundColor: colors.accent }]} /> : null}
            <Icon name={map[route.name] ?? 'compass'} size={24} color={color} />
            <Text
              variant="caption"
              tone={color}
              style={{ fontFamily: focused ? fonts.bodySemi : fonts.bodyMedium, fontSize: type.caption.fontSize }}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: 1 },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 3 },
  indicator: { position: 'absolute', top: 0, left: 18, right: 18, height: 3, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
});

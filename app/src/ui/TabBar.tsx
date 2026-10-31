import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { fonts, type } from '@/theme/tokens';
import { Icon, type IconName } from './Icon';
import { Reveal } from './Reveal';
import { Logo } from './Logo';
import { lightHaptic } from './haptics';
import { Text } from './Text';
import { useInsets } from './useInsets';

/** Structural subset of React Navigation's BottomTabBarProps (so no extra dependency is needed). */
export interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  descriptors: Record<string, { options: { title?: string; tabBarAccessibilityLabel?: string } }>;
  /** React Navigation 7 (current expo-router): `emitter.emit` + `navigateToTab(routeKey)`. */
  emitter?: { emit: (event: any) => unknown };
  navigateToTab?: (routeKey: string) => void;
  /** Legacy shape (tests, older navigators). */
  navigation?: {
    emit: (event: any) => { defaultPrevented: boolean };
    navigate: (...args: any[]) => void;
  };
  /** Route name to icon. Defaults cover index/explorar, mapa, comunidade, salvos, perfil. */
  icons?: Record<string, IconName>;
  /** 'rail' = vertical side rail for wide screens (>= 1024): max 240px wide, 48px items, logo mark on top. */
  variant?: 'bottom' | 'rail';
}

const DEFAULT_ICONS: Record<string, IconName> = {
  index: 'compass',
  explorar: 'compass',
  mapa: 'map',
  comunidade: 'message',
  salvos: 'bookmark',
  perfil: 'user',
};

export const TAB_BAR_HEIGHT = 64;

/** Custom bar for expo-router Tabs: 64px + safe area, active = pink + 3px top indicator + selected state. */
export function TabBar({ state, descriptors, navigation, emitter, navigateToTab, icons, variant = 'bottom' }: TabBarProps) {
  const rail = variant === 'rail';
  const { colors } = useTheme();
  const insets = useInsets();
  const map = { ...DEFAULT_ICONS, ...icons };
  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        rail
          ? [styles.rail, { paddingTop: insets.top + 20, backgroundColor: colors.surface, borderRightColor: colors.border }]
          : { height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom, backgroundColor: colors.surface, borderTopColor: colors.border },
      ]}>
      {rail ? (
        <View style={styles.railLogo}>
          <Logo size={40} variant="neon" />
        </View>
      ) : null}
      {state.routes.map((route, i) => {
        const focused = state.index === i;
        const { options } = descriptors[route.key] ?? { options: {} };
        const label = options.title ?? route.name;
        const color = focused ? colors.accent : colors.textMuted;
        const onPress = () => {
          const emit = emitter?.emit ?? navigation?.emit;
          const event = emit?.({ type: 'tabPress', target: route.key, canPreventDefault: true });
          const prevented = !!(event as { defaultPrevented?: boolean } | undefined)?.defaultPrevented;
          if (!focused && !prevented) {
            lightHaptic();
            if (navigateToTab) navigateToTab(route.key);
            else navigation?.navigate(route.name);
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
            style={rail ? [styles.railTab, focused && { backgroundColor: colors.surfaceAlt }] : styles.tab}
            {...webProps}>
            {focused ? (
              <Reveal
                rise={false}
                testID="tab-indicator"
                style={[rail ? styles.railIndicator : styles.indicator, { backgroundColor: colors.accent }]}>
                {null}
              </Reveal>
            ) : null}
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
  rail: { flexDirection: 'column', width: 240, maxWidth: 240, borderTopWidth: 0, borderRightWidth: 1, paddingHorizontal: 12, gap: 4 },
  railLogo: { paddingHorizontal: 12, paddingBottom: 16 },
  railTab: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 12, paddingHorizontal: 12, borderRadius: 14 },
  railIndicator: { position: 'absolute', left: 0, top: 12, bottom: 12, width: 3, borderRadius: 2 },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 3 },
  indicator: { position: 'absolute', top: 0, left: 18, right: 18, height: 3, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
});

import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { maxContentWidth } from '@/theme/tokens';
import { useBreakpoint } from './useBreakpoint';
import { useInsets } from './useInsets';

export interface ScreenProps {
  children: ReactNode;
  /** Wrap content in a vertical ScrollView. */
  scroll?: boolean;
  /** Safe-area edges to pad. Default top only (the tab bar owns the bottom). */
  edges?: ('top' | 'bottom')[];
  /** Drop horizontal gutters (for full-bleed shelves). */
  bleed?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Safe area + max width 1280 + responsive gutters (16/24/32). */
export function Screen({ children, scroll, edges = ['top'], bleed, style, contentStyle, testID }: ScreenProps) {
  const { colors } = useTheme();
  const { gutter } = useBreakpoint();
  const insets = useInsets();
  const pad = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
  };
  const inner = [styles.inner, { paddingHorizontal: bleed ? 0 : gutter }, contentStyle];
  return (
    <View testID={testID} style={[styles.root, { backgroundColor: colors.background }, pad, style]}>
      {scroll ? (
        <ScrollView contentContainerStyle={inner} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, inner]}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  inner: { width: '100%', maxWidth: maxContentWidth, alignSelf: 'center' },
});

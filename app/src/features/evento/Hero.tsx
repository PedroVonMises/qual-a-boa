import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import type { CoverKey } from '@/domain/types';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { Cover, IconButton, Scrim, useBreakpoint } from '@/ui';
import { useInsets } from '@/ui/useInsets';

export interface HeroProps {
  coverKey: CoverKey;
  onBack: () => void;
  /** Right-side action buttons. */
  actions?: ReactNode;
}

/** Cover hero: 380px on phones, wide 280px rounded banner at >= 1024. Scrim + fade into the background. */
export function Hero({ coverKey, onBack, actions }: HeroProps) {
  const { colors } = useTheme();
  const { isLarge } = useBreakpoint();
  const insets = useInsets();
  return (
    <View testID="hero" style={[styles.box, isLarge ? styles.banner : styles.full]}>
      <Cover coverKey={coverKey} style={StyleSheet.absoluteFill} />
      <Scrim />
      <View pointerEvents="none" style={styles.fade}>
        <Svg width="100%" height="100%" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="qab-hero-fade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.background} stopOpacity={0} />
              <Stop offset="1" stopColor={colors.background} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#qab-hero-fade)" />
        </Svg>
      </View>
      <View style={[styles.bar, { top: (isLarge ? 0 : insets.top) + space.sm }]}>
        <IconButton icon="chevronLeft" label="Voltar" variant="filled" onPress={onBack} />
        <View style={styles.actions}>{actions}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: '100%', overflow: 'hidden' },
  full: { height: 380 },
  banner: { height: 280, borderRadius: radius.lg, marginTop: space.lg },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 120 },
  bar: { position: 'absolute', left: space.lg, right: space.lg, flexDirection: 'row', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', gap: space.sm },
});

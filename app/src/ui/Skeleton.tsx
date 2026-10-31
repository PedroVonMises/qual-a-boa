import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { useReduceMotion } from './useReduceMotion';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/** Shimmer block (opacity pulse only). Static when Reduce Motion is on. Hidden from screen readers. */
export function Skeleton({ width = '100%', height = 16, radius: r = 8, style }: SkeletonProps) {
  const { colors } = useTheme();
  const reduce = useReduceMotion();
  const o = useSharedValue(1);

  useEffect(() => {
    if (reduce) {
      o.value = 1;
      return;
    }
    o.value = withRepeat(withTiming(0.5, { duration: 800, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [reduce, o]);

  const anim = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: r, backgroundColor: colors.surfaceAlt }, anim, style]}
    />
  );
}

/** Skeletons matching the exact EventCard dimensions. */
export function EventCardSkeleton({ variant = 'poster' }: { variant?: 'poster' | 'row' }) {
  if (variant === 'poster') return <Skeleton width={264} height={240} radius={radius.lg} />;
  return (
    <View style={styles.row} accessibilityLabel="Carregando" accessibilityRole="progressbar">
      <Skeleton width={72} height={72} radius={14} />
      <View style={styles.lines}>
        <Skeleton width="70%" height={18} />
        <Skeleton width="50%" height={14} />
        <Skeleton width="35%" height={14} />
      </View>
    </View>
  );
}

/** Skeleton matching a ThreadCard: event line, two title lines, footer line. */
export function ThreadCardSkeleton() {
  return (
    <View style={styles.thread} accessibilityLabel="Carregando" accessibilityRole="progressbar">
      <Skeleton width="40%" height={14} />
      <Skeleton width="90%" height={20} />
      <Skeleton width="65%" height={20} />
      <Skeleton width="30%" height={14} />
    </View>
  );
}

const styles = StyleSheet.create({
  thread: { minHeight: 112, paddingVertical: space.lg, gap: space.sm },
  row: { minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  lines: { flex: 1, gap: space.sm },
});

import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { motion, palette } from '@/theme/tokens';

import { BrandBulb } from './BrandBulb';

type Props = {
  /** True once fonts and session are ready; the overlay then fades out and unmounts. */
  ready: boolean;
};

/**
 * In-app splash that continues the native splash. Wine background plus the static bulb.
 * TODO(orchestrator): swap BrandBulb for the ui AnimatedLogo (draw-on, then flicker).
 */
export function SplashOverlay({ ready }: Props) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!ready) return;
    const duration = reduceMotion ? motion.reducedFadeMs : 350;
    const hold = reduceMotion ? 0 : 250;
    opacity.value = withDelay(
      hold,
      withTiming(0, { duration }, (finished) => {
        if (finished) runOnJS(setGone)(true);
      }),
    );
  }, [ready, reduceMotion, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (gone) return null;
  return (
    <Animated.View
      pointerEvents={ready ? 'none' : 'auto'}
      style={[StyleSheet.absoluteFill, styles.root, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <BrandBulb size={160} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: palette.wine, alignItems: 'center', justifyContent: 'center', zIndex: 100 },
});

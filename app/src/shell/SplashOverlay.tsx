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
import { AnimatedLogo } from '@/ui';

type Props = {
  /** True once fonts and session are ready; the overlay then fades out and unmounts. */
  ready: boolean;
};

/**
 * In-app splash that continues the native splash: wine background plus the animated bulb
 * (tube draws on, core flickers on). It fades out only after the logo animation finished AND the app is ready.
 */
export function SplashOverlay({ ready }: Props) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  const [animDone, setAnimDone] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!ready || !animDone) return;
    const duration = reduceMotion ? motion.reducedFadeMs : 350;
    const hold = reduceMotion ? 0 : 250;
    opacity.value = withDelay(
      hold,
      withTiming(0, { duration }, (finished) => {
        if (finished) runOnJS(setGone)(true);
      }),
    );
  }, [ready, animDone, reduceMotion, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (gone) return null;
  return (
    <Animated.View
      pointerEvents={ready && animDone ? 'none' : 'auto'}
      style={[StyleSheet.absoluteFill, styles.root, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <AnimatedLogo size={200} onDone={() => setAnimDone(true)} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: palette.wine, alignItems: 'center', justifyContent: 'center', zIndex: 100 },
});

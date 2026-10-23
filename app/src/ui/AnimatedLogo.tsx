import { useEffect, useRef } from 'react';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { motion, palette } from '@/theme/tokens';
import { Logo, MARK } from './Logo';
import { useReduceMotion } from './useReduceMotion';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const ARC_LEN = 340; // arc length is ~329 at r=62 over 304 degrees
const LEG_LEN = 20;

export interface AnimatedLogoProps {
  size?: number;
  onDone?: () => void;
}

/** Splash logo: the tube draws on (700 ms), then the amber core flickers on. Reduce Motion: final lit state. */
export function AnimatedLogo({ size = 160, onDone }: AnimatedLogoProps) {
  const reduce = useReduceMotion();
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });

  const draw = useSharedValue(0);
  const core = useSharedValue(0);

  useEffect(() => {
    if (reduce) {
      doneRef.current?.();
      return;
    }
    const { drawMs, flickerMs } = motion.splash;
    draw.value = withTiming(1, { duration: drawMs, easing: Easing.out(Easing.cubic) });
    const step = flickerMs / 6;
    core.value = withDelay(
      drawMs,
      withSequence(
        withTiming(1, { duration: step * 0.5 }),
        withTiming(0.1, { duration: step }),
        withTiming(1, { duration: step * 0.8 }),
        withTiming(0.3, { duration: step * 1.2 }),
        withTiming(1, { duration: step * 1.5 }),
        withTiming(0.7, { duration: step * 0.5 }),
        withTiming(1, { duration: step * 1.5 }),
      ),
    );
    const t = setTimeout(() => doneRef.current?.(), drawMs + flickerMs);
    return () => clearTimeout(t);
  }, [reduce, draw, core]);

  const arcProps = useAnimatedProps(() => ({ strokeDashoffset: ARC_LEN * (1 - draw.value) }));
  const legProps = useAnimatedProps(() => ({ strokeDashoffset: LEG_LEN * (1 - draw.value) }));
  const baseProps = useAnimatedProps(() => ({ opacity: draw.value > 0.85 ? 1 : 0 }));
  const coreProps = useAnimatedProps(() => ({ opacity: core.value }));

  if (reduce) return <Logo size={size} variant="color" />;

  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" accessibilityRole="image" accessibilityLabel="Qual a boa?">
      <G transform={MARK.transform}>
        <G fill="none" stroke={palette.riotPink} strokeWidth={16} strokeLinecap="round">
          <AnimatedPath d={MARK.arc} strokeDasharray={`${ARC_LEN}`} animatedProps={arcProps} />
          <AnimatedPath d={MARK.legs} strokeDasharray={`${LEG_LEN}`} animatedProps={legProps} />
        </G>
        <AnimatedRect {...MARK.base1} fill={palette.riotPink} animatedProps={baseProps} />
        <AnimatedRect {...MARK.base2} fill={palette.riotPink} animatedProps={baseProps} />
        <AnimatedCircle {...MARK.core} fill={palette.amber} animatedProps={coreProps} />
      </G>
    </Svg>
  );
}

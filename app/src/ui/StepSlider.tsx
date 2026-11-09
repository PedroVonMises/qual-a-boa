import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';
import { hit, motion, radius, space } from '@/theme/tokens';
import { lightHaptic } from './haptics';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';
import { Text } from './Text';
import { useReduceMotion } from './useReduceMotion';

export interface StepSliderProps<T> {
  steps: readonly T[];
  value: T;
  onChange: (v: T) => void;
  /** Screen-reader name of the whole control (e.g. "Preço máximo"). */
  label: string;
  /** Long label: the value line above the track and each dot's accessible name. */
  formatValue: (v: T) => string;
  /** Short caption under each dot. */
  formatShort: (v: T) => string;
  /** Drag along the track to snap between steps. Default true. */
  draggable?: boolean;
  testID?: string;
  valueTestID?: string;
}

/**
 * Index of the step nearest to `x` (px from the track's left edge). Stops are `stop` px wide and spread
 * with space-between across `width`, so their centres run from stop/2 to width - stop/2.
 */
export function snapIndex(x: number, width: number, count: number, stop: number = hit.min): number {
  if (count <= 1) return 0;
  const span = width - stop;
  if (span <= 0) return 0;
  const raw = Math.round(((x - stop / 2) / span) * (count - 1));
  return Math.min(count - 1, Math.max(0, raw));
}

/** Slider-like control over discrete stops: tap a dot, drag along the track, or screen-reader increment/decrement. */
export function StepSlider<T>({
  steps,
  value,
  onChange,
  label,
  formatValue,
  formatShort,
  draggable = true,
  testID,
  valueTestID,
}: StepSliderProps<T>) {
  const { colors } = useTheme();
  const reduce = useReduceMotion();
  const last = steps.length - 1;
  const index = Math.max(0, steps.indexOf(value));
  const ratio = last > 0 ? index / last : 0;

  const progress = useSharedValue(ratio);
  useEffect(() => {
    progress.set(reduce ? ratio : withSpring(ratio, motion.spring));
  }, [ratio, reduce, progress]);
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));

  const move = (d: number) => onChange(steps[Math.min(last, Math.max(0, index + d))]);

  // Drag runs on the JS thread (runOnJS) so it can call onChange. `lastIndex` tracks the stop under the finger
  // between renders, so a stop fires onChange and the haptic once even if several updates land before a re-render.
  const [width, setWidth] = useState(0);
  const lastIndex = useRef(index);
  useEffect(() => {
    lastIndex.current = index;
  }, [index]);
  const dragTo = (x: number) => {
    const next = snapIndex(x, width, steps.length);
    if (next === lastIndex.current) return;
    lastIndex.current = next;
    lightHaptic();
    onChange(steps[next]);
  };
  const pan = usePanGesture({
    runOnJS: true,
    enabled: draggable,
    activeOffsetX: [-6, 6],
    failOffsetY: [-12, 12],
    onActivate: (e) => dragTo(e.x),
    onUpdate: (e) => dragTo(e.x),
  });

  const track = (
    <View
      style={styles.track}
      testID={testID ? `${testID}-track` : undefined}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <View style={[styles.line, { backgroundColor: colors.surfaceAlt }]} />
      <Animated.View style={[styles.line, styles.fill, { backgroundColor: colors.accent }, fill]} />
      <View style={styles.stops}>
        {steps.map((step, i) => {
          const selected = i === index;
          return (
            <PressableScale
              key={String(step)}
              accessibilityRole="button"
              accessibilityLabel={formatValue(step)}
              accessibilityState={{ selected }}
              onPress={() => onChange(step)}
              style={styles.stop}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: i <= index ? colors.accent : colors.surfaceAlt, borderColor: colors.background },
                ]}>
                {selected ? <Icon name="check" size={14} color={colors.onAccent} strokeWidth={3} /> : null}
              </View>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );

  return (
    <View
      accessible={false}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: formatValue(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => move(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      testID={testID}>
      <Text variant="mono" testID={valueTestID} style={styles.value}>
        {formatValue(value)}
      </Text>
      {draggable ? <GestureDetector gesture={pan}>{track}</GestureDetector> : track}
      <View style={styles.labels}>
        {steps.map((step) => (
          <Text key={String(step)} variant="caption" tone="textMuted" style={styles.label}>
            {formatShort(step)}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  value: { marginBottom: space.sm },
  track: { height: hit.min, justifyContent: 'center' },
  line: { position: 'absolute', left: hit.min / 2, right: hit.min / 2, height: 4, borderRadius: 2 },
  // Full-length accent line scaled from its left edge, so the fill animates without measuring.
  fill: { transformOrigin: 'left center' },
  stops: { flexDirection: 'row', justifyContent: 'space-between' },
  stop: { width: hit.min, height: hit.min, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 24, height: 24, borderRadius: radius.full, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { width: hit.min, textAlign: 'center' },
});

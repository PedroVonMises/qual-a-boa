import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius } from '@/theme/tokens';
import { MapSheetHandle, snapHeights, type MapSheetIndex, type MapSheetProps } from './mapSheetShared';
import { useInsets } from './useInsets';
import { useReduceMotion } from './useReduceMotion';

export {
  MAP_SHEET_PEEK,
  MAP_SHEET_STATES,
  MAP_SHEET_TABLET_MAX_WIDTH,
  snapHeights,
  type MapSheetIndex,
  type MapSheetProps,
  type MapSheetRef,
} from './mapSheetShared';

/** On web the sheet does not own scrolling: a plain ScrollView. */
export const MapSheetScrollView = ScrollView;

/** Flick speed (px/s) that moves one snap in the flick's direction regardless of where the drag ends. */
const FLICK = 600;

/** Snap for a drag that ended at `h` with vertical velocity `vy` (px/s, positive = downwards). */
export function settleIndex(heights: readonly number[], h: number, vy: number): MapSheetIndex {
  let nearest = 0;
  heights.forEach((s, i) => {
    if (Math.abs(s - h) < Math.abs(heights[nearest] - h)) nearest = i;
  });
  if (Math.abs(vy) > FLICK) {
    const above = heights.findIndex((s) => s > h + 1);
    const below = heights.map((s, i) => (s < h - 1 ? i : -1)).filter((i) => i >= 0).pop();
    if (vy < 0 && above >= 0) return above as MapSheetIndex;
    if (vy > 0 && below !== undefined) return below as MapSheetIndex;
  }
  return nearest as MapSheetIndex;
}

/**
 * Web MapSheet: same three snaps and handle as native, driven by a Gesture Handler v3 pan on the handle area and a
 * Reanimated height. Springs from the tokens; Reduce Motion = a short timing without spring.
 */
export function MapSheet({
  index,
  onIndexChange,
  children,
  splitFraction = 0.5,
  bottomInset = 0,
  topInset,
  maxWidth,
  animatedPosition,
  ref,
  testID,
  style,
}: MapSheetProps) {
  const { colors } = useTheme();
  const insets = useInsets();
  const reduce = useReduceMotion();
  const { height: windowH } = useWindowDimensions();
  const [containerH, setContainerH] = useState(0);
  const avail = containerH || windowH;
  const heights = snapHeights(avail, splitFraction, topInset ?? insets.top, bottomInset);
  const height = useSharedValue(heights[index]);
  const start = useSharedValue(0);
  const heightsRef = useRef(heights);
  const indexRef = useRef(index);
  useEffect(() => {
    heightsRef.current = heights;
    indexRef.current = index;
  });

  const target = heights[index];
  const animateTo = (h: number) => {
    height.set(reduce ? withTiming(h, { duration: motion.reducedFadeMs }) : withSpring(h, { ...motion.spring }));
    animatedPosition?.set(avail - bottomInset - h);
  };
  // Snap whenever the state or the available space changes.
  useEffect(() => {
    animateTo(target);
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({ snapToIndex: (i) => onIndexChange(i) }), [onIndexChange]);

  const pan = usePanGesture({
    runOnJS: true,
    activeOffsetY: [-6, 6],
    onActivate: () => {
      start.set(height.get());
    },
    onUpdate: (e) => {
      const hs = heightsRef.current;
      height.set(Math.min(hs[2], Math.max(hs[0], start.get() - e.translationY)));
    },
    onDeactivate: (e) => {
      const next = settleIndex(heightsRef.current, height.get(), e.velocityY);
      if (next === indexRef.current) animateTo(heightsRef.current[next]);
      else onIndexChange(next);
    },
  });

  const sheetStyle = useAnimatedStyle(() => ({ height: height.get() }));

  return (
    <View
      pointerEvents="box-none"
      style={[StyleSheet.absoluteFill, { bottom: bottomInset }]}
      onLayout={(e: LayoutChangeEvent) => setContainerH(e.nativeEvent.layout.height + bottomInset)}>
      <Animated.View
        testID={testID}
        style={[
          styles.sheet,
          { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
          maxWidth ? { maxWidth, marginHorizontal: 'auto' } : null,
          sheetStyle,
          style,
        ]}>
        <GestureDetector gesture={pan}>
          <View>
            <MapSheetHandle index={index} onChange={onIndexChange} />
          </View>
        </GestureDetector>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, overflow: 'hidden' },
});

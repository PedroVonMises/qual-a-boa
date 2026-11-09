import BottomSheet, { BottomSheetScrollView, useBottomSheetSpringConfigs, useBottomSheetTimingConfigs } from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, type ComponentType } from 'react';
import { StyleSheet, View, useWindowDimensions, type ScrollViewProps } from 'react-native';
import { ReduceMotion } from 'react-native-reanimated';

import { useTheme } from '@/theme/ThemeProvider';
import { motion, radius } from '@/theme/tokens';
import { clampIndex, MAP_SHEET_PEEK, MapSheetHandle, type MapSheetIndex, type MapSheetProps } from './mapSheetShared';
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

/** Scroll container for content inside the MapSheet (coordinates its scroll with the sheet drag on native). */
export const MapSheetScrollView = BottomSheetScrollView as unknown as ComponentType<ScrollViewProps>;

/**
 * Non-modal bottom sheet over a map with three snaps: Mapa cheio (peek 88), Dividido (50%), Lista cheia.
 * Native: @gorhom/bottom-sheet. No backdrop, no pan-down-to-close. Springs from the tokens; Reduce Motion = a short
 * timing without spring. The handle is rendered inside the content so it stays accessible (adjustable).
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
  const { width } = useWindowDimensions();
  const sheetRef = useRef<BottomSheet>(null);
  const current = useRef<MapSheetIndex>(index);

  const snapPoints = useMemo(() => [MAP_SHEET_PEEK, `${Math.round(splitFraction * 100)}%`, '100%'], [splitFraction]);
  const spring = useBottomSheetSpringConfigs({ ...motion.spring });
  const timing = useBottomSheetTimingConfigs({ duration: motion.reducedFadeMs });

  useImperativeHandle(ref, () => ({ snapToIndex: (i) => sheetRef.current?.snapToIndex(i) }), []);

  // Controlled: snap when the parent changes the state (pills, back button, handle, pin selection).
  useEffect(() => {
    if (current.current === index) return;
    current.current = index;
    sheetRef.current?.snapToIndex(index);
  }, [index]);

  const onChange = useCallback(
    (i: number) => {
      if (i < 0) return;
      const next = clampIndex(i);
      if (next === current.current) return;
      current.current = next;
      onIndexChange(next);
    },
    [onIndexChange],
  );

  const sideMargin = maxWidth && width > maxWidth ? (width - maxWidth) / 2 : 0;

  return (
    <BottomSheet
      ref={sheetRef}
      index={index}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose={false}
      onChange={onChange}
      topInset={topInset ?? insets.top}
      bottomInset={bottomInset}
      handleComponent={null}
      animationConfigs={reduce ? timing : spring}
      overrideReduceMotion={ReduceMotion.Never}
      animatedPosition={animatedPosition}
      accessible={false}
      style={[{ marginHorizontal: sideMargin }, style]}
      backgroundStyle={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }}>
      <View style={styles.content} testID={testID}>
        <MapSheetHandle index={index} onChange={onIndexChange} />
        {children}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
});

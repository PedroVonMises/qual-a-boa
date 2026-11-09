import type { ReactNode, Ref } from 'react';
import type { SharedValue } from 'react-native-reanimated';
import { Pressable, StyleSheet, View, type AccessibilityActionEvent, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { hit, space } from '@/theme/tokens';

/** 0 = Mapa cheio (peek), 1 = Dividido, 2 = Lista cheia. */
export type MapSheetIndex = 0 | 1 | 2;

export const MAP_SHEET_STATES = ['Mapa cheio', 'Dividido', 'Lista cheia'] as const;
/** Peek height: the handle (44) plus the list header, so "Nesta área · N eventos" stays visible. */
export const MAP_SHEET_PEEK = 88;
/** Width cap on tablets (640–1023); the sheet is centered. */
export const MAP_SHEET_TABLET_MAX_WIDTH = 560;

export interface MapSheetRef {
  snapToIndex: (index: MapSheetIndex) => void;
}

export interface MapSheetProps {
  /** Controlled state: the sheet snaps whenever this changes. */
  index: MapSheetIndex;
  /** Called when a drag, the handle or an accessibility action settles on a new state. */
  onIndexChange: (index: MapSheetIndex) => void;
  children: ReactNode;
  /** Fraction of the container height for "Dividido". Default 0.5 (0.6 in phone landscape). */
  splitFraction?: number;
  /** Px kept free under the sheet (e.g. a tab bar that overlays the screen). Default 0. */
  bottomInset?: number;
  /** Px kept free above the sheet at "Lista cheia". Default the safe-area top. */
  topInset?: number;
  /** Centered width cap (tablets). */
  maxWidth?: number;
  /** Live sheet top in px from the container top (follows drags), for views that track the sheet edge. */
  animatedPosition?: SharedValue<number>;
  ref?: Ref<MapSheetRef>;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export const clampIndex = (i: number): MapSheetIndex => (i <= 0 ? 0 : i >= 2 ? 2 : (i as MapSheetIndex));

/** Tap on the handle: peek and split grow by one step, the full list goes back to split. */
export const tapTarget = (i: MapSheetIndex): MapSheetIndex => (i === 2 ? 1 : clampIndex(i + 1));

/**
 * Snap heights in px for a container of `height`: [peek, split, full]. Full leaves `topInset` free;
 * split never drops below peek nor exceeds full.
 */
export function snapHeights(height: number, splitFraction: number, topInset: number, bottomInset = 0): [number, number, number] {
  const avail = Math.max(MAP_SHEET_PEEK, height - bottomInset);
  const full = Math.max(MAP_SHEET_PEEK, avail - topInset);
  const split = Math.min(full, Math.max(MAP_SHEET_PEEK, Math.round(avail * splitFraction)));
  return [MAP_SHEET_PEEK, split, full];
}

/**
 * Handle: a 40×4 bar inside a full-width, 44px-tall target. Adjustable for screen readers ("Tamanho da lista",
 * value = the state name); increment/decrement step the state, a tap toggles it.
 */
export function MapSheetHandle({ index, onChange }: { index: MapSheetIndex; onChange: (i: MapSheetIndex) => void }) {
  const { colors } = useTheme();
  const onAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'increment') onChange(clampIndex(index + 1));
    else if (e.nativeEvent.actionName === 'decrement') onChange(clampIndex(index - 1));
    else if (e.nativeEvent.actionName === 'activate') onChange(tapTarget(index));
  };
  return (
    <Pressable
      testID="map-sheet-handle"
      accessibilityRole="adjustable"
      accessibilityLabel="Tamanho da lista"
      accessibilityValue={{ text: MAP_SHEET_STATES[index] }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }, { name: 'activate' }]}
      onAccessibilityAction={onAction}
      onPress={() => onChange(tapTarget(index))}
      style={styles.handleHit}>
      <View style={[styles.bar, { backgroundColor: colors.textMuted }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  handleHit: { alignSelf: 'stretch', height: hit.min, alignItems: 'center', justifyContent: 'center', paddingTop: space.xs },
  bar: { width: 40, height: 4, borderRadius: 2 },
});

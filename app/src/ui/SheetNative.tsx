import BottomSheet, { BottomSheetBackdrop, BottomSheetView, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useCallback } from 'react';
import { Modal, StyleSheet, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { SheetHeader } from './SheetHeader';
import type { SheetProps } from './sheetTypes';
import { useInsets } from './useInsets';

export function SheetNative({ onClose, title, children, footer, testID }: SheetProps) {
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const insets = useInsets();

  const backdrop = useCallback(
    (p: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...p} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" opacity={0.6} />
    ),
    [],
  );

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={styles.root} testID={testID}>
        <BottomSheet
          index={0}
          enableDynamicSizing
          maxDynamicContentSize={height * 0.85}
          enablePanDownToClose
          onClose={onClose}
          backdropComponent={backdrop}
          backgroundStyle={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }}
          handleIndicatorStyle={{ backgroundColor: colors.textMuted }}>
          <BottomSheetView style={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.lg }}>
            <SheetHeader title={title} onClose={onClose} />
            {children}
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </BottomSheetView>
        </BottomSheet>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  footer: { flexDirection: 'row', gap: space.md, paddingTop: space.lg },
});

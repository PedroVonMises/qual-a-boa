import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { SheetHeader } from './SheetHeader';
import type { SheetProps } from './sheetTypes';
import { useBreakpoint } from './useBreakpoint';

const DRAWER_W = 420;

export function SheetWeb({ onClose, title, children, footer, testID }: SheetProps) {
  const { colors } = useTheme();
  const { isLarge, height } = useBreakpoint();
  const panel = isLarge
    ? [styles.drawer, { width: DRAWER_W }]
    : [styles.bottom, { maxHeight: height * 0.85 }];
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View style={[styles.root, isLarge ? styles.rootEnd : styles.rootBottom]} testID={testID}>
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={onClose} style={[StyleSheet.absoluteFill, styles.backdrop]} />
        <View
          accessibilityViewIsModal
          accessibilityLabel={title}
          style={[panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.pad}>
            <SheetHeader title={title} onClose={onClose} />
          </View>
          <ScrollView style={styles.flex} contentContainerStyle={styles.pad}>
            {children}
          </ScrollView>
          {footer ? <View style={[styles.pad, styles.footer, { borderTopColor: colors.border }]}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  rootEnd: { flexDirection: 'row', justifyContent: 'flex-end' },
  rootBottom: { justifyContent: 'flex-end' },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.6)' },
  drawer: { height: '100%', borderLeftWidth: 1 },
  bottom: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderTopWidth: 1 },
  flex: { flexGrow: 0 },
  pad: { padding: space.lg },
  footer: { borderTopWidth: 1, flexDirection: 'row', gap: space.md },
});

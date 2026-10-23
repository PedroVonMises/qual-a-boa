import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { hit, radius, space } from '@/theme/tokens';
import { PressableScale, Text } from '@/ui';

export const UNDO_MS = 5000;

export interface UndoToastProps {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
}

/** Inline snackbar with a 5 s auto-dismiss. No animation, so Reduce Motion is respected by construction. */
export function UndoToast({ message, onUndo, onDismiss }: UndoToastProps) {
  const { colors } = useTheme();
  useEffect(() => {
    const t = setTimeout(onDismiss, UNDO_MS);
    return () => clearTimeout(t);
  }, [message, onDismiss]);
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.bar, { backgroundColor: colors.surfaceAlt }]}>
      <Text variant="bodySm" style={styles.msg}>
        {message}
      </Text>
      <PressableScale accessibilityRole="button" accessibilityLabel="Desfazer" onPress={onUndo} style={styles.btn}>
        <Text variant="bodySm" tone="accent" style={styles.bold}>
          Desfazer
        </Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingLeft: space.lg,
    paddingRight: space.sm,
    borderRadius: radius.md,
    minHeight: hit.button,
  },
  msg: { flex: 1 },
  btn: { minHeight: hit.min, minWidth: hit.min, justifyContent: 'center', paddingHorizontal: space.md },
  bold: { fontWeight: '700' },
});

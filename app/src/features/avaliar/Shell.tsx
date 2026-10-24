import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { IconButton, Text, useBreakpoint } from '@/ui';
import { useInsets } from '@/ui/useInsets';

export const FLOW_MAX_WIDTH = 640;

interface ShellProps {
  step: 1 | 2;
  onBack: () => void;
  children: ReactNode;
  footer: ReactNode;
}

/** Header (back/close + "n de 2"), scrolling body and a sticky footer shared by both Avaliar steps. */
export function Shell({ step, onBack, children, footer }: ShellProps) {
  const { colors } = useTheme();
  const { gutter } = useBreakpoint();
  const insets = useInsets();
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.col, styles.header, { paddingHorizontal: gutter }]}>
        <IconButton
          icon={step === 1 ? 'close' : 'chevronLeft'}
          label={step === 1 ? 'Fechar' : 'Voltar'}
          variant="filled"
          onPress={onBack}
        />
        <Text variant="mono" tone="textMuted" accessibilityLabel={`Etapa ${step} de 2`}>
          {step} de 2
        </Text>
      </View>
      <ScrollView
        style={styles.flex}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>
        <View style={[styles.col, { paddingHorizontal: gutter, gap: space.lg }]}>{children}</View>
      </ScrollView>
      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + space.md }]}>
        <View style={[styles.col, styles.footerRow, { paddingHorizontal: gutter }]}>{footer}</View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  col: { width: '100%', maxWidth: FLOW_MAX_WIDTH, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56 },
  scroll: { flexGrow: 1, paddingTop: space.sm, paddingBottom: space.xxxl },
  footer: { borderTopWidth: 1, paddingTop: space.md },
  footerRow: { flexDirection: 'row', gap: space.md },
});

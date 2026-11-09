import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { NARROW_MAX_WIDTH } from '@/features/layout';
import { useTheme } from '@/theme/ThemeProvider';
import { hit, radius, space } from '@/theme/tokens';
import { Icon, PressableScale, Screen, ScreenHeader, Text } from '@/ui';
import { dayMonth } from './format';

/** Header + scrolling body + sticky footer (primary CTA), centered column on wide screens. */
export function CasasShell({
  title,
  onBack,
  footer,
  children,
  testID,
}: {
  title: string;
  onBack?: () => void;
  footer?: ReactNode;
  children: ReactNode;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Screen testID={testID} edges={['top', 'bottom']}>
      <ScreenHeader title={title} onBack={onBack} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.column} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
        {footer ? <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}

/** Small uppercase section caption, announced as a header. */
export function Caption({ children, style }: { children: string; style?: object }) {
  return (
    <Text variant="caption" tone="textMuted" accessibilityRole="header" style={style}>
      {children}
    </Text>
  );
}

/** "Passo 1 de 3" + segmented progress bar. */
export function StepBar({ step, total, label }: { step: number; total: number; label: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={styles.stepBar}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Passo ${step} de ${total}: ${label}`}
      accessibilityValue={{ min: 1, max: total, now: step }}
      testID="casas-stepbar">
      <View style={styles.stepTrack}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={[styles.stepSeg, { backgroundColor: i < step ? colors.accent : colors.surfaceAlt }]} />
        ))}
      </View>
      <Text variant="caption" tone="textMuted">
        {`PASSO ${step} DE ${total} · ${label.toUpperCase()}`}
      </Text>
    </View>
  );
}

/** Checkbox row: 44+ target, check icon (not color alone), accessible checked state. */
export function CheckRow({
  label,
  checked,
  onToggle,
  error,
  testID,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  error?: string;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.checkWrap}>
      <PressableScale
        accessibilityRole="checkbox"
        accessibilityLabel={label}
        accessibilityState={{ checked }}
        onPress={onToggle}
        style={styles.checkRow}
        testID={testID}>
        <View
          style={[
            styles.box,
            {
              borderColor: error ? colors.danger : checked ? colors.accent : colors.textMuted,
              backgroundColor: checked ? colors.accent : 'transparent',
            },
          ]}>
          {checked ? <Icon name="check" size={16} color={colors.onAccent} strokeWidth={3} /> : null}
        </View>
        <Text variant="body" style={styles.flex}>
          {label}
        </Text>
      </PressableScale>
      {error ? (
        <Text variant="bodySm" tone="dangerText" accessibilityLiveRegion="polite" testID={testID ? `${testID}-error` : undefined}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** Feature line with a check icon. */
export function CheckLine({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.checkLine}>
      <Icon name="check" size={20} color={colors.success} />
      <Text variant="body" style={styles.flex}>
        {children}
      </Text>
    </View>
  );
}

/**
 * Read-only quota meter in the StepSlider look (track, accent fill, 24px dots, check on the last used slot).
 * Announced as a progress bar with "2 de 4 festas".
 */
export function QuotaMeter({ used, limit, testID }: { used: number; limit: number; testID?: string }) {
  const { colors } = useTheme();
  const shown = Math.min(used, limit);
  const ratio = limit > 0 ? shown / limit : 0;
  const text = `${shown} de ${limit} festas`;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Festas do mês"
      accessibilityValue={{ min: 0, max: limit, now: shown, text }}
      testID={testID}>
      <Text variant="mono" style={styles.meterValue} testID={testID ? `${testID}-value` : undefined}>
        {text}
      </Text>
      <View style={styles.track}>
        <View style={[styles.line, { backgroundColor: colors.surfaceAlt }]} />
        <View style={[styles.line, styles.fill, { backgroundColor: colors.accent, transform: [{ scaleX: ratio }] }]} />
        <View style={styles.stops}>
          {Array.from({ length: limit + 1 }, (_, i) => (
            <View key={i} style={styles.stop}>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: i <= shown ? colors.accent : colors.surfaceAlt, borderColor: colors.background },
                ]}>
                {i === shown ? <Icon name="check" size={14} color={colors.onAccent} strokeWidth={3} /> : null}
              </View>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.stops}>
        {Array.from({ length: limit + 1 }, (_, i) => (
          <Text key={i} variant="caption" tone="textMuted" style={styles.stopLabel}>
            {String(i)}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** past_due warning: icon + danger text, never a red button. */
export function PastDueAlert({ periodEnd }: { periodEnd: string | null }) {
  const { colors } = useTheme();
  const until = periodEnd ? ` até ${dayMonth(periodEnd)}` : '';
  return (
    <View
      style={[styles.alert, { borderColor: colors.danger, backgroundColor: colors.surface }]}
      accessibilityRole="alert"
      testID="casas-past-due">
      <Icon name="clock" size={20} color={colors.dangerText} />
      <Text variant="bodySm" tone="dangerText" style={styles.flex}>
        {`Não conseguimos cobrar seu cartão. Atualize${until} para manter suas festas.`}
      </Text>
    </View>
  );
}

/** "Label ........ value" line of a summary card; value in mono when it is a number. */
export function SummaryRow({ label, value, mono, divider = true }: { label: string; value: string; mono?: boolean; divider?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.summaryRow, divider && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <Text variant="bodySm" tone="textMuted">
        {label}
      </Text>
      <Text variant={mono ? 'mono' : 'body'} style={styles.summaryValue}>
        {value}
      </Text>
    </View>
  );
}

export function Card({ children, style, testID }: { children: ReactNode; style?: object; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]} testID={testID}>
      {children}
    </View>
  );
}

/** Inline message under a form or CTA (errors in dangerText, with the fix). */
export function Note({ text, tone = 'muted', testID }: { text?: string | null; tone?: 'error' | 'muted'; testID?: string }) {
  if (!text) return null;
  return (
    <Text variant="bodySm" tone={tone === 'error' ? 'dangerText' : 'textMuted'} accessibilityLiveRegion="polite" testID={testID}>
      {text}
    </Text>
  );
}

export const casasStyles = StyleSheet.create({
  gap: { gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  section: { marginTop: space.lg },
  wrapChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  column: { width: '100%', maxWidth: NARROW_MAX_WIDTH, alignSelf: 'center', gap: space.md, paddingBottom: space.xxxl },
  footer: {
    width: '100%',
    maxWidth: NARROW_MAX_WIDTH,
    alignSelf: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    borderTopWidth: 1,
  },
  stepBar: { gap: space.sm, marginBottom: space.sm },
  stepTrack: { flexDirection: 'row', gap: space.xs },
  stepSeg: { flex: 1, height: 4, borderRadius: 2 },
  checkWrap: { gap: space.xs },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: hit.min },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkLine: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  meterValue: { marginBottom: space.sm },
  track: { height: hit.min, justifyContent: 'center' },
  line: { position: 'absolute', left: hit.min / 2, right: hit.min / 2, height: 4, borderRadius: 2 },
  fill: { transformOrigin: 'left center' },
  stops: { flexDirection: 'row', justifyContent: 'space-between' },
  stop: { width: hit.min, height: hit.min, alignItems: 'center', justifyContent: 'center' },
  stopLabel: { width: hit.min, textAlign: 'center' },
  dot: { width: 24, height: 24, borderRadius: radius.full, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  alert: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, padding: space.md, borderRadius: radius.md, borderWidth: 1 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.md, paddingVertical: space.md, flexWrap: 'wrap' },
  summaryValue: { flexShrink: 1, textAlign: 'right' },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: space.lg, gap: space.md },
});

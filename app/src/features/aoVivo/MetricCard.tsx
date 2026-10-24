import { StyleSheet, View } from 'react-native';

import { formatRelative } from '@/domain/format';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { Badge, Text } from '@/ui';
import type { Metric } from './logic';

export interface MetricCardProps {
  label: string;
  /** Formatted value; undefined renders the honest "sem relato" state. */
  metric?: Metric<unknown>;
  valueText?: string;
  /** Extra text under the value, e.g. "4 de 5". */
  extra?: string;
  nowMs: number;
  testID?: string;
}

/** One live signal: value + age + sample size. Stale values say so in words. */
export function MetricCard({ label, metric, valueText, extra, nowMs, testID }: MetricCardProps) {
  const { colors } = useTheme();
  const has = metric && valueText;
  const age = metric ? formatRelative(metric.at, nowMs) : '';
  const sample = metric ? (metric.stale ? 'último relato' : `${metric.n} ${metric.n === 1 ? 'relato' : 'relatos'}`) : '';
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={has ? `${label}: ${valueText}${extra ? `, ${extra}` : ''}. ${sample}, ${age}${metric.stale ? '. Desatualizado' : ''}` : `${label}: sem relatos`}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text variant="caption" tone="textMuted">
        {label}
      </Text>
      {has ? (
        <>
          <Text variant="headline" tone={metric.stale ? 'textMuted' : 'text'}>
            {valueText}
          </Text>
          {extra ? <Text variant="bodySm">{extra}</Text> : null}
          <Text variant="caption" tone="textMuted">
            {sample} · {age}
          </Text>
          {metric.stale ? <Badge label="Desatualizado" icon="clock" /> : null}
        </>
      ) : (
        <Text variant="bodySm" tone="textMuted">
          Ainda sem relatos
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexBasis: '47%', flexGrow: 1, minHeight: 44, borderWidth: 1, borderRadius: radius.lg, padding: space.md, gap: space.xs },
});

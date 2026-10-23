import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';
import { Text } from './Text';

export interface ScoreBarProps {
  label: string;
  value: number;
  max?: number;
  style?: StyleProp<ViewStyle>;
}

/** Labelled topic score (e.g. "Som 4,6"). The number is always shown next to the bar. */
export function ScoreBar({ label, value, max = 5, style }: ScoreBarProps) {
  const { colors } = useTheme();
  const pct = Math.max(0, Math.min(1, value / max));
  const shown = (Math.round(value * 10) / 10).toString().replace('.', ',');
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${label}, ${shown} de ${max}`}
      accessibilityValue={{ min: 0, max, now: value }}
      style={[styles.row, style]}>
      <Text variant="bodySm" style={styles.label}>
        {label}
      </Text>
      <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
        <View style={[styles.fill, { backgroundColor: colors.accent, width: `${pct * 100}%` }]} />
      </View>
      <Text variant="mono" style={styles.value}>
        {shown}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 28 },
  label: { width: 96 },
  track: { flex: 1, height: 8, borderRadius: radius.full, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radius.full },
  value: { width: 32, textAlign: 'right' },
});

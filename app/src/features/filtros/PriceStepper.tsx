import { StyleSheet, View } from 'react-native';

import { formatBRL } from '@/domain/format';
import { hit, radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { Icon, PressableScale, Text } from '@/ui';

export const PRICE_STEPS: (number | null)[] = [0, 20, 40, 60, null];

export function priceStepLabel(v: number | null): string {
  if (v === null) return 'Sem limite';
  if (v === 0) return 'Grátis';
  return `Até ${formatBRL(v).replace(',00', '')}`;
}

function shortLabel(v: number | null): string {
  if (v === null) return 'Sem limite';
  return v === 0 ? 'Grátis' : formatBRL(v).replace(',00', '');
}

interface Props {
  value: number | null;
  onChange: (v: number | null) => void;
}

/** Slider-like control: five discrete stops, adjustable by tap or by screen-reader increment/decrement. */
export function PriceStepper({ value, onChange }: Props) {
  const { colors } = useTheme();
  const index = Math.max(0, PRICE_STEPS.indexOf(value));
  const move = (d: number) => {
    const next = PRICE_STEPS[Math.min(PRICE_STEPS.length - 1, Math.max(0, index + d))];
    onChange(next);
  };
  return (
    <View
      accessible={false}
      accessibilityRole="adjustable"
      accessibilityLabel="Preço máximo"
      accessibilityValue={{ text: priceStepLabel(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => move(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      testID="price-stepper">
      <Text variant="mono" testID="price-value" style={styles.value}>
        {priceStepLabel(value)}
      </Text>
      <View style={styles.track}>
        <View style={[styles.line, { backgroundColor: colors.surfaceAlt }]} />
        <View style={[styles.line, { backgroundColor: colors.accent, width: `${(index / (PRICE_STEPS.length - 1)) * 100}%` }]} />
        <View style={styles.stops}>
          {PRICE_STEPS.map((step, i) => {
            const selected = i === index;
            return (
              <PressableScale
                key={String(step)}
                accessibilityRole="button"
                accessibilityLabel={priceStepLabel(step)}
                accessibilityState={{ selected }}
                onPress={() => onChange(step)}
                style={styles.stop}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: i <= index ? colors.accent : colors.surfaceAlt, borderColor: colors.background },
                  ]}>
                  {selected ? <Icon name="check" size={14} color={colors.onAccent} strokeWidth={3} /> : null}
                </View>
              </PressableScale>
            );
          })}
        </View>
      </View>
      <View style={styles.labels}>
        {PRICE_STEPS.map((step) => (
          <Text key={String(step)} variant="caption" tone="textMuted" style={styles.label}>
            {shortLabel(step)}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  value: { marginBottom: space.sm },
  track: { height: hit.min, justifyContent: 'center' },
  line: { position: 'absolute', left: hit.min / 2, right: hit.min / 2, height: 4, borderRadius: 2 },
  stops: { flexDirection: 'row', justifyContent: 'space-between' },
  stop: { width: hit.min, height: hit.min, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 24, height: 24, borderRadius: radius.full, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  labels: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { width: hit.min, textAlign: 'center' },
});

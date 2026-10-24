import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { hit, radius } from '@/theme/tokens';
import { PressableScale, Text } from '@/ui';
import { radioGroup } from '@/ui/radioGroup';

const DOTS = [1, 2, 3, 4, 5] as const;

interface TopicRowProps {
  label: string;
  value: number | undefined;
  onChange: (value: 1 | 2 | 3 | 4 | 5 | undefined) => void;
}

/**
 * Optional topic score. Each dot is a 44px radio hit area around a 28px visual dot; filled up to the value,
 * outlined beyond it (shape, not color alone). Tapping the current value clears it.
 */
export function TopicRow({ label, value, onChange }: TopicRowProps) {
  const { colors } = useTheme();
  const rg = radioGroup(value ? value - 1 : -1, DOTS.length, (i) => onChange((i + 1) as 1 | 2 | 3 | 4 | 5));
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.row}>
      <View style={styles.head}>
        <Text variant="body">{label}</Text>
        <Text variant="mono" tone="textMuted">
          {value ? `${value} de 5` : 'Sem nota'}
        </Text>
      </View>
      <View style={styles.dots} {...rg.group}>
        {DOTS.map((n) => {
          const on = !!value && n <= value;
          return (
            <PressableScale
              key={n}
              accessibilityRole="radio"
              accessibilityLabel={`${label}, nota ${n}`}
              accessibilityState={{ checked: value === n }}
              {...rg.item(n - 1)}
              onPress={() => onChange(value === n ? undefined : n)}
              scaleTo={0.9}
              style={styles.target}>
              <View
                style={[
                  styles.dot,
                  on
                    ? { backgroundColor: colors.accent, borderColor: colors.accent }
                    : { backgroundColor: 'transparent', borderColor: colors.textMuted },
                ]}
              />
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: hit.min },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 28 },
  dots: { flexDirection: 'row' },
  target: { width: hit.min, height: hit.min, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 28, height: 28, borderRadius: radius.full, borderWidth: 2 },
});

import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { palette } from '@/theme/tokens';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';
import { radioGroup } from './radioGroup';
import { Text } from './Text';

const STARS = [1, 2, 3, 4, 5] as const;

export interface RatingProps {
  value: number;
  /** When provided the rating is an input: five 52px targets. Otherwise it is a compact display. */
  onChange?: (value: number) => void;
  /** Display mode: number of reviews, shown in mono next to the stars. */
  count?: number;
  size?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

function format(n: number) {
  return (Math.round(n * 10) / 10).toString().replace('.', ',');
}

export function Rating({ value, onChange, count, size = 16, style, testID }: RatingProps) {
  if (onChange) {
    const selected = Math.round(value) >= 1 ? Math.round(value) - 1 : -1;
    const rg = radioGroup(selected, STARS.length, (i) => onChange(i + 1));
    return (
      <View testID={testID} accessibilityRole="radiogroup" accessibilityLabel="Sua nota" style={[styles.row, style]} {...rg.group}>
        {STARS.map((n) => (
          <PressableScale
            key={n}
            accessibilityRole="radio"
            accessibilityLabel={`${n} ${n === 1 ? 'estrela' : 'estrelas'}`}
            accessibilityState={{ checked: n === Math.round(value) }}
            {...rg.item(n - 1)}
            onPress={() => onChange(n)}
            style={styles.target}>
            <Icon name={n <= value ? 'starFilled' : 'star'} size={32} color={palette.amber} />
          </PressableScale>
        ))}
      </View>
    );
  }
  const filled = Math.round(value);
  const label = `Nota ${format(value)} de 5${count !== undefined ? `, ${count} avaliações` : ''}`;
  return (
    <View testID={testID} accessible accessibilityRole="image" accessibilityLabel={label} style={[styles.row, styles.display, style]}>
      {STARS.map((n) => (
        <Icon key={n} name={n <= filled ? 'starFilled' : 'star'} size={size} color={palette.amber} />
      ))}
      <Text variant="mono" tone="textMuted" style={styles.value}>
        {format(value)}
        {count !== undefined ? ` (${count})` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  display: { gap: 2 },
  target: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  value: { marginLeft: 6 },
});

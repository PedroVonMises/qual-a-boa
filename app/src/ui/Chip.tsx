import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { hit, radius } from '@/theme/tokens';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  count?: number;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** 44px toggle chip. Selected = pink fill + check icon (never color alone). */
export function Chip({ label, selected = false, count, onPress, disabled, style, testID }: ChipProps) {
  const { colors } = useTheme();
  const fg = selected ? colors.onAccent : colors.text;
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={count === undefined ? label : `${label}, ${count}`}
      accessibilityState={{ selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.base,
        { backgroundColor: selected ? colors.accent : colors.surfaceAlt },
        disabled && styles.disabled,
        style,
      ]}>
      {selected ? <Icon name="check" size={16} color={fg} strokeWidth={3} /> : null}
      <Text variant="bodySm" tone={fg} style={selected ? styles.bold : undefined}>
        {label}
      </Text>
      {count !== undefined ? (
        <Text variant="mono" tone={selected ? colors.onAccent : colors.textMuted}>
          {count}
        </Text>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    height: hit.chip,
    minHeight: hit.chip,
    paddingHorizontal: 18,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
  bold: { fontWeight: '600' },
  disabled: { opacity: 0.4 },
});


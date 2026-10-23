import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { hit, radius } from '@/theme/tokens';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';

export interface IconButtonProps {
  icon: IconName;
  /** Required: icon-only controls need an accessible name. */
  label: string;
  onPress?: () => void;
  variant?: 'plain' | 'filled' | 'accent';
  /** Icon color override (theme role or literal). */
  color?: string;
  selected?: boolean;
  disabled?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function IconButton({
  icon,
  label,
  onPress,
  variant = 'plain',
  color,
  selected,
  disabled,
  size = 22,
  style,
  testID,
}: IconButtonProps) {
  const { colors } = useTheme();
  const bg = variant === 'filled' ? colors.surfaceAlt : variant === 'accent' ? colors.accent : 'transparent';
  const fg = color ?? (variant === 'accent' ? colors.onAccent : colors.text);
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.base, { backgroundColor: bg }, disabled && styles.disabled, style]}>
      <Icon name={icon} size={size} color={fg} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    width: hit.min,
    height: hit.min,
    minWidth: hit.min,
    minHeight: hit.min,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
});

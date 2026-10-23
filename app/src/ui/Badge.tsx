import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'danger';

export interface BadgeProps {
  /** The status is always spelled out in text; color and icon only reinforce it. */
  label: string;
  tone?: BadgeTone;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}

export function Badge({ label, tone = 'neutral', icon, style }: BadgeProps) {
  const { colors } = useTheme();
  const fg =
    tone === 'accent' ? colors.accent : tone === 'success' ? colors.success : tone === 'danger' ? colors.dangerText : colors.text;
  return (
    <View style={[styles.base, { backgroundColor: colors.background, borderColor: colors.border }, style]}>
      {icon ? <Icon name={icon} size={14} color={fg} /> : null}
      <Text variant="caption" tone={fg} style={styles.label}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 28,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  label: { fontWeight: '600' },
});

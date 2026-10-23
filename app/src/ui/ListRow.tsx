import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  /** Right-aligned value text (mono). */
  value?: string;
  chevron?: boolean;
  onPress?: () => void;
  /** Hairline divider under the row. */
  divider?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function ListRow({ title, subtitle, icon, value, chevron, onPress, divider, disabled, style, testID }: ListRowProps) {
  const { colors } = useTheme();
  const body = (
    <>
      {icon ? <Icon name={icon} size={22} color="textMuted" /> : null}
      <View style={styles.text}>
        <Text variant="body">{title}</Text>
        {subtitle ? (
          <Text variant="bodySm" tone="textMuted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? <Text variant="mono">{value}</Text> : null}
      {chevron ? <Icon name="chevronRight" size={20} color="textMuted" /> : null}
    </>
  );
  const rowStyle = [styles.row, divider && { borderBottomWidth: 1, borderBottomColor: colors.border }, disabled && styles.disabled, style];
  if (!onPress) {
    return (
      <View testID={testID} style={rowStyle}>
        {body}
      </View>
    );
  }
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      scaleTo={0.99}
      style={rowStyle}>
      {body}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  text: { flex: 1, gap: 2 },
  disabled: { opacity: 0.4 },
});

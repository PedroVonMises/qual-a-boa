import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { Icon } from './Icon';
import { Text } from './Text';

export interface AvatarProps {
  handle?: string;
  /** 0-359; derived tint behind the initial. */
  hue?: number;
  anonymous?: boolean;
  size?: number;
}

/** Round initial avatar. Anonymous authors get a neutral user glyph. Decorative: the name is rendered beside it. */
export function Avatar({ handle, hue = 340, anonymous = false, size = 32 }: AvatarProps) {
  const { colors } = useTheme();
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (anonymous || !handle) {
    return (
      <View style={[styles.base, box, { backgroundColor: colors.surfaceAlt }]} importantForAccessibility="no-hide-descendants">
        <Icon name="user" size={Math.round(size * 0.6)} color="textMuted" />
      </View>
    );
  }
  return (
    <View
      style={[styles.base, box, { backgroundColor: `hsl(${hue}, 38%, 30%)` }]}
      importantForAccessibility="no-hide-descendants">
      <Text variant="bodySm" tone="#F4F1EC" style={styles.initial}>
        {handle[0].toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontWeight: '600' },
});

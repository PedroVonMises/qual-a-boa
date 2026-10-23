import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius } from '@/theme/tokens';
import { Text } from './Text';

/** 28px non-interactive genre tag. */
export function Tag({ label, style }: { label: string; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.base, { backgroundColor: colors.surfaceAlt }, style]}>
      <Text variant="caption" tone="textMuted">
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
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
});

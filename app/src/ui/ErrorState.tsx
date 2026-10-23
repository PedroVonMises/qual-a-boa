import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { Button } from './Button';
import { Icon } from './Icon';
import { Text } from './Text';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  retryLabel?: string;
  onRetry?: () => void;
  /** Compact inline banner instead of a full-area state. */
  inline?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Inline error with retry. The problem is stated in text; the red tint only reinforces it. */
export function ErrorState({
  title = 'Não deu pra carregar',
  message = 'Confira sua conexão e tente de novo.',
  retryLabel = 'Tentar de novo',
  onRetry,
  inline,
  style,
}: ErrorStateProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[inline ? styles.inline : styles.wrap, inline && { backgroundColor: colors.surface, borderColor: colors.danger }, style]}>
      <Icon name="close" size={inline ? 20 : 32} color={colors.dangerText} />
      <View accessible accessibilityRole="alert" style={inline ? styles.inlineText : styles.centerText}>
        <Text variant={inline ? 'bodySm' : 'title'} tone={colors.dangerText} style={inline ? styles.bold : styles.center}>
          {title}
        </Text>
        <Text variant={inline ? 'caption' : 'body'} tone="textMuted" style={inline ? undefined : styles.center}>
          {message}
        </Text>
      </View>
      {onRetry ? <Button label={retryLabel} variant={inline ? 'ghost' : 'secondary'} onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xxxl },
  centerText: { gap: space.xs, alignItems: 'center' },
  center: { textAlign: 'center' },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  inlineText: { flex: 1 },
  bold: { fontWeight: '600' },
});

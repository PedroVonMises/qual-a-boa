import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { space } from '@/theme/tokens';
import { Button } from './Button';
import { Logo } from './Logo';
import { Text } from './Text';

export interface EmptyStateProps {
  title: string;
  /** A specific next step, e.g. "Aumente o raio para 10 km". */
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Unlit bulb + title + specific next action. */
export function EmptyState({ title, message, actionLabel, onAction, style }: EmptyStateProps) {
  return (
    <View style={[styles.wrap, style]}>
      <Logo size={96} variant="off" />
      <Text variant="headline" style={styles.center} accessibilityRole="header">
        {title}
      </Text>
      {message ? (
        <Text variant="body" tone="textMuted" style={styles.center}>
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} style={styles.action} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xxxl },
  center: { textAlign: 'center' },
  action: { marginTop: space.sm },
});

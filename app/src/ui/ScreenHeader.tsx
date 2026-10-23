import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { hit, space } from '@/theme/tokens';
import { IconButton } from './IconButton';
import { Text } from './Text';

export interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  /** Right-side slot (actions). */
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Back + title (+ actions). All slots are 44px. */
export function ScreenHeader({ title, onBack, right, style }: ScreenHeaderProps) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.side}>{onBack ? <IconButton icon="chevronLeft" label="Voltar" onPress={onBack} variant="filled" /> : null}</View>
      <Text variant="title" accessibilityRole="header" numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      <View style={[styles.side, styles.sideEnd]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  side: { minWidth: hit.min, alignItems: 'flex-start' },
  sideEnd: { alignItems: 'flex-end' },
  title: { flex: 1, textAlign: 'center' },
});

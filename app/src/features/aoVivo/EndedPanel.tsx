import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { Button, Text } from '@/ui';

/** Shown instead of the live metrics once the event is over: no stale numbers, just a way to rate it. */
export function EndedPanel({ onRate }: { onRate: () => void }) {
  const { colors } = useTheme();
  return (
    <View testID="ao-vivo-ended" style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text variant="title" accessibilityRole="header">
        Encerrado
      </Text>
      <Text variant="bodySm" tone="textMuted">
        Este evento já terminou, então não mostramos fila, lotação ou preço. Conte como foi para ajudar quem vai nos próximos.
      </Text>
      <Button label="Avaliar este evento" onPress={onRate} testID="ao-vivo-avaliar" />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.md, padding: space.lg, gap: space.sm },
});

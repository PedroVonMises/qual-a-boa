import { StyleSheet } from 'react-native';

import { ufName } from '@/domain/region';
import { useRegion } from '@/state/region';
import { useTheme } from '@/theme/ThemeProvider';
import { hit, radius, space } from '@/theme/tokens';
import { Icon, PressableScale, Text } from '@/ui';

/** Shows the state whose conversations the Comunidade lists; opens the state picker. Same shape as the Explorar pills. */
export function StatePill({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  const name = ufName(useRegion((s) => s.uf));
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Estado: ${name}. Alterar`}
      onPress={onPress}
      style={[styles.pill, { backgroundColor: colors.surfaceAlt }]}
      testID="state-pill">
      <Icon name="pin" size={18} color="accent" />
      <Text variant="bodySm" numberOfLines={1} style={styles.label}>
        {name}
      </Text>
      <Icon name="chevronDown" size={16} color="textMuted" />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: hit.chip,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.full,
    maxWidth: '100%',
  },
  label: { flexShrink: 1 },
});

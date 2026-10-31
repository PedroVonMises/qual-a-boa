import { StyleSheet, View } from 'react-native';

import { Icon } from './Icon';
import { Text } from './Text';

/** "Mais útil" marker for the comment most people found helpful. `votes` adds the "· N pessoas" suffix. */
export function HelpfulBadge({ votes }: { votes?: number }) {
  const label = votes === undefined ? 'Mais útil' : `Mais útil · ${votes} ${votes === 1 ? 'pessoa' : 'pessoas'}`;
  return (
    <View style={styles.row} accessible accessibilityLabel={label}>
      <Icon name="spark" size={12} color="accent" strokeWidth={1} />
      <Text variant="caption" tone="accent" style={styles.label}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  label: { fontWeight: '600' },
});

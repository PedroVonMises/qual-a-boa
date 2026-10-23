import { StyleSheet, View } from 'react-native';

import { space } from '@/theme/tokens';
import { IconButton } from './IconButton';
import { Text } from './Text';

export function SheetHeader({ title, onClose }: { title?: string; onClose: () => void }) {
  return (
    <View style={styles.row}>
      <Text variant="title" accessibilityRole="header" style={styles.title}>
        {title ?? ''}
      </Text>
      <IconButton icon="close" label="Fechar" onPress={onClose} variant="filled" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: space.md },
  title: { flex: 1 },
});

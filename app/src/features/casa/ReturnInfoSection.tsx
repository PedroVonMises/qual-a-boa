import { StyleSheet, View } from 'react-native';

import { hasReturnInfo, RETURN_INFO_SOURCE, returnInfoRows, type ReturnInfo } from '@/domain/returnInfo';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { Text } from '@/ui';

/** "Na volta" (S8): ride-hailing pickup, street lighting, bus stop, parking. Nothing renders until the casa fills it. */
export function ReturnInfoSection({ info, title = 'Na volta', testID = 'casa-volta' }: { info?: ReturnInfo; title?: string; testID?: string }) {
  const { colors } = useTheme();
  if (!hasReturnInfo(info)) return null;
  return (
    <View style={styles.section} testID={testID}>
      <Text variant="title" accessibilityRole="header">
        {title}
      </Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {returnInfoRows(info).map((r) => (
          <View key={r.key} style={styles.row} accessible accessibilityLabel={`${r.label}: ${r.value}`} testID={`${testID}-${r.key}`}>
            <Text variant="bodySm" tone="textMuted">
              {r.label}
            </Text>
            <Text variant="body">{r.value}</Text>
          </View>
        ))}
        <Text variant="caption" tone="textMuted">
          {RETURN_INFO_SOURCE}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm, marginTop: space.sm },
  card: { borderWidth: 1, borderRadius: radius.md, padding: space.lg, gap: space.md },
  row: { gap: 2 },
});

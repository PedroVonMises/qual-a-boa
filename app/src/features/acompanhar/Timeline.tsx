import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { Icon, Text } from '@/ui';
import { STATUS_LABEL, type TimelineStep } from './logic';

/** Vertical timeline. Each step spells its status in text ("feito", "agora", "a seguir"); the icon only reinforces it. */
export function Timeline({ steps }: { steps: TimelineStep[] }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="list" style={styles.list}>
      {steps.map((s) => (
        <View key={s.key} accessible accessibilityRole="text" accessibilityLabel={`${s.title}, ${STATUS_LABEL[s.status]}. ${s.detail}`} style={styles.row}>
          <View style={styles.mark}>
            {s.status === 'done' ? (
              <Icon name="check" size={22} color="success" strokeWidth={2.5} />
            ) : s.status === 'current' ? (
              <Icon name="clock" size={22} color="accent" strokeWidth={2.5} />
            ) : (
              <View style={[styles.hollow, { borderColor: colors.textMuted }]} />
            )}
          </View>
          <View style={styles.body}>
            <Text variant="body" style={s.status === 'todo' ? { color: colors.textMuted } : styles.bold}>
              {s.title}{' '}
              <Text variant="bodySm" tone="textMuted">
                · {STATUS_LABEL[s.status]}
              </Text>
            </Text>
            <Text variant="bodySm" tone="textMuted">
              {s.detail}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.md, minHeight: 44, alignItems: 'flex-start' },
  mark: { width: 24, height: 24, marginTop: 2, alignItems: 'center', justifyContent: 'center' },
  hollow: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
  body: { flex: 1, gap: 2 },
  bold: { fontWeight: '600' },
});

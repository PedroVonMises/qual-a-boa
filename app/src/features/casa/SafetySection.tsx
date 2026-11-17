import { StyleSheet, View } from 'react-native';

import type { SafetyProtocol } from '@/domain/safetyProtocol';
import { feltSafeLabel, safetyAverageLabel, safetyIndexCaption } from '@/domain/safetyIndex';
import { SafetyProtocolSeal } from '@/features/evento/SafetyProtocolSeal';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { Icon, Skeleton, Text } from '@/ui';
import { useVenueSafety } from './useVenueSafety';

/** "Segurança" block of the venue page: the S1 seal and the S2 index from people who checked in. */
export function SafetySection({ venue }: { venue: { id: string; slug: string; safetyProtocol?: SafetyProtocol } }) {
  const { colors } = useTheme();
  const q = useVenueSafety(venue);
  const stats = q.data;
  const avg = stats ? safetyAverageLabel(stats) : null;
  const felt = stats ? feltSafeLabel(stats) : null;
  return (
    <View style={styles.section} testID="casa-seguranca">
      <Text variant="title" accessibilityRole="header">
        Segurança
      </Text>
      <SafetyProtocolSeal status={venue.safetyProtocol} />
      {q.isPending ? (
        <Skeleton height={72} radius={radius.md} />
      ) : q.isError || !stats ? null : (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="casa-indice-seguranca">
          <View style={styles.head}>
            <Icon name="shield" size={20} color="textMuted" />
            <Text variant="bodySm" tone="textMuted">
              Índice de segurança
            </Text>
          </View>
          {avg ? (
            <Text variant="headline" accessibilityLabel={`Índice de segurança ${avg}`} testID="casa-indice-valor">
              {avg}
            </Text>
          ) : null}
          {felt ? <Text variant="body">{felt}</Text> : null}
          <Text variant="bodySm" tone="textMuted" testID="casa-indice-legenda">
            {safetyIndexCaption(stats)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm, marginTop: space.sm },
  card: { borderWidth: 1, borderRadius: radius.md, padding: space.lg, gap: space.xs },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});

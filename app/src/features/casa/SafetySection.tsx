import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { SafetyProtocol } from '@/domain/safetyProtocol';
import { feltSafeLabel, safetyAverageLabel, safetyIndexCaption } from '@/domain/safetyIndex';
import { SafetyProtocolSeal } from '@/features/evento/SafetyProtocolSeal';
import { EmergencyActions } from '@/features/seguranca/EmergencyActions';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { Icon, ListRow, Skeleton, Text } from '@/ui';
import { useVenueSafety } from './useVenueSafety';

/** "Segurança" block of the venue page: the S1 seal and the S2 index from people who checked in. */
export function SafetySection({ venue }: { venue: { id: string; slug: string; name: string; address?: string; lat: number; lng: number; safetyProtocol?: SafetyProtocol } }) {
  const { colors } = useTheme();
  const router = useRouter();
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
      <ListRow
        title="Aconteceu algo comigo"
        subtitle="Ligar 190 ou 180 e fazer um relato privado"
        icon="shield"
        chevron
        onPress={() => router.push(`/seguranca/relato?casa=${encodeURIComponent(venue.slug)}` as Href)}
        testID="casa-relato"
      />
      <EmergencyActions place={{ name: venue.name, address: venue.address, lat: venue.lat, lng: venue.lng }} testID="casa-emergencia" />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm, marginTop: space.sm },
  card: { borderWidth: 1, borderRadius: radius.md, padding: space.lg, gap: space.xs },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});

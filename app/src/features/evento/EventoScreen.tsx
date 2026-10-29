import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatDistance, formatEventDate, formatPriceLabel } from '@/domain/format';
import { useEvent, useGenres } from '@/data/queries';
import { useRecordView } from '@/state/useRecordView';
import { useFavorites } from '@/state/favorites';
import { useLocation } from '@/state/location';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { ArtistRow, Badge, Button, IconButton, PressableScale, Tag, Text, useBreakpoint } from '@/ui';
import { Frame, StateShell, useGoBack } from './Frame';
import { Hero } from './Hero';
import { isHttpsUrl, openMaps } from './linking';
import { genreLabels } from './labels';
import { ShareSheet } from './ShareSheet';

export function EventoScreen({ id }: { id?: string }) {
  const { colors } = useTheme();
  const { gutter } = useBreakpoint();
  const router = useRouter();
  const goBack = useGoBack();
  const { location } = useLocation();
  const q = useEvent(id, location);
  useRecordView('event', q.data ? id : undefined);
  const genres = useGenres().data;
  const saved = useFavorites((s) => s.eventIds.includes(id ?? ''));
  const toggleEvent = useFavorites((s) => s.toggleEvent);
  const [shareOpen, setShareOpen] = useState(false);

  if (q.isPending && q.fetchStatus !== 'idle') return <StateShell state="loading" />;
  if (q.isError) return <StateShell state="error" onRetry={() => q.refetch()} />;
  if (!q.data) {
    return <StateShell state="missing" notFound={{ title: 'Evento não encontrado', message: 'Ele pode ter sido removido. Volte e veja o que está rolando hoje.' }} />;
  }

  const { event, venue, lineup, distanceKm } = q.data;
  const cancelled = event.status === 'cancelled';
  const canBuy = !cancelled && isHttpsUrl(event.ticketUrl);
  const tags = genreLabels(event.genreSlugs, genres);
  const go = (path: string) => router.push(path as Href);

  // Tickets go through the Ingressos step, which says where the purchase ends before leaving the app.
  const buy = () => {
    if (canBuy) router.push({ pathname: '/ingressos/[id]', params: { id: event.id } });
  };

  return (
    <Frame
      footer={
        <>
          <Button label="Como chegar" variant="secondary" icon="pin" onPress={() => openMaps(venue.name, venue.lat, venue.lng)} style={styles.flex} />
          <Button
            label={canBuy ? 'Ver ingressos' : 'Ingressos indisponíveis'}
            disabled={!canBuy}
            onPress={buy}
            accessibilityHint={canBuy ? 'Mostra preço, meia-entrada e o site onde a compra termina' : undefined}
            style={styles.flex}
          />
        </>
      }>
      <Hero
        coverKey={event.coverKey}
        onBack={goBack}
        actions={
          <>
            <IconButton icon="share" label="Compartilhar evento" variant="filled" onPress={() => setShareOpen(true)} />
            <IconButton
              icon={saved ? 'heartFilled' : 'heart'}
              label={saved ? 'Remover dos salvos' : 'Salvar evento'}
              selected={saved}
              variant="filled"
              color={saved ? colors.accent : undefined}
              onPress={() => toggleEvent(event.id)}
            />
          </>
        }
      />
      <View style={[styles.body, { paddingHorizontal: gutter }]}>
        {cancelled ? (
          <View accessibilityRole="alert" style={[styles.banner, { backgroundColor: colors.surface, borderColor: colors.danger }]}>
            <Badge label="Evento cancelado" tone="danger" icon="close" />
            <Text variant="bodySm" tone="textMuted">
              Este evento não vai acontecer. Fique de olho nos próximos da casa.
            </Text>
          </View>
        ) : null}
        {tags.length ? (
          <View style={styles.tags}>
            {tags.map((t) => (
              <Tag key={t} label={t} />
            ))}
          </View>
        ) : null}
        <Text variant="display" accessibilityRole="header">
          {event.title}
        </Text>
        <PressableScale accessibilityRole="link" accessibilityLabel={`Casa ${venue.name}`} onPress={() => go(`/casa/${venue.slug}`)} style={styles.link}>
          <Text variant="body" tone="accent" style={styles.bold}>
            {[venue.name, venue.area, distanceKm != null ? formatDistance(distanceKm) : undefined].filter(Boolean).join(' · ')}
          </Text>
        </PressableScale>
        <View style={styles.meta}>
          <Text variant="mono">{formatEventDate(event.startsAt)}</Text>
          <Text variant="mono">{formatPriceLabel(event.priceMin, event.priceMax, event.isFree)}</Text>
        </View>
        <Text variant="bodySm" tone="textMuted">
          {event.ageMin >= 18 ? 'Maiores de 18 anos' : `Classificação ${event.ageMin} anos`}
        </Text>
        {lineup.length ? (
          <View style={styles.section}>
            <Text variant="title" accessibilityRole="header">
              Line-up
            </Text>
            {lineup.map((a, i) => (
              <ArtistRow
                key={a.id}
                name={a.name}
                subtitle={genreLabels(a.genreSlugs, genres).join(' · ') || undefined}
                imageUri={a.photoUrl}
                divider={i < lineup.length - 1}
                onPress={() => go(`/artista/${a.slug}`)}
              />
            ))}
          </View>
        ) : null}
        <PressableScale accessibilityRole="link" accessibilityLabel="Ver avaliações" onPress={() => go(`/avaliacoes/${event.id}`)} style={styles.link}>
          <Text variant="bodySm" tone="accent" style={styles.bold}>
            Ver avaliações
          </Text>
        </PressableScale>
      </View>
      <ShareSheet visible={shareOpen} onClose={() => setShareOpen(false)} event={event} venue={venue} />
    </Frame>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { gap: space.md, paddingTop: space.sm },
  banner: { borderWidth: 1, borderRadius: radius.md, padding: space.md, gap: space.sm },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  bold: { fontWeight: '600' },
  meta: { flexDirection: 'row', gap: space.lg },
  section: { gap: space.xs, marginTop: space.sm },
});

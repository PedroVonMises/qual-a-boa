import { useRouter, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { formatEventDate, formatPriceLabel } from '@/domain/format';
import { useArtist, useGenres } from '@/data/queries';
import { Frame, StateShell, useGoBack } from '@/features/evento/Frame';
import { Hero } from '@/features/evento/Hero';
import { genreLabels, monthYear } from '@/features/evento/labels';
import { useFavorites } from '@/state/favorites';
import { useLocation } from '@/state/location';
import { space } from '@/theme/tokens';
import { EventCard, IconButton, Tag, Text, VenueRow, useBreakpoint } from '@/ui';

export function ArtistaScreen({ slug }: { slug?: string }) {
  const { gutter } = useBreakpoint();
  const router = useRouter();
  const goBack = useGoBack();
  const { location } = useLocation();
  const q = useArtist(slug, location);
  const genres = useGenres().data;
  const eventIds = useFavorites((s) => s.eventIds);
  const toggleEvent = useFavorites((s) => s.toggleEvent);
  const artistSlugs = useFavorites((s) => s.artistSlugs);
  const toggleArtist = useFavorites((s) => s.toggleArtist);

  if (q.isPending && q.fetchStatus !== 'idle') return <StateShell state="loading" />;
  if (q.isError) return <StateShell state="error" onRetry={() => q.refetch()} />;
  if (!q.data) {
    return <StateShell state="missing" notFound={{ title: 'Artista não encontrado', message: 'Confira o endereço ou volte e procure outro artista.' }} />;
  }

  const { artist, upcoming, playedAt } = q.data;
  const go = (path: string) => router.push(path as Href);
  const coverKey = playedAt[0]?.venue.coverKey ?? upcoming[0]?.venue.coverKey ?? 'generic';
  const showsLabel = `${upcoming.length} ${upcoming.length === 1 ? 'próximo show' : 'próximos shows'}`;
  const venuesLabel = `${playedAt.length} ${playedAt.length === 1 ? 'casa' : 'casas'}`;

  return (
    <Frame>
      <Hero
        coverKey={coverKey}
        onBack={goBack}
        actions={
          <IconButton
            icon={artistSlugs.includes(artist.slug) ? 'heartFilled' : 'heart'}
            label={artistSlugs.includes(artist.slug) ? 'Remover artista dos salvos' : 'Salvar artista'}
            selected={artistSlugs.includes(artist.slug)}
            variant="filled"
            onPress={() => toggleArtist(artist.slug)}
          />
        }
      />
      <View style={[styles.body, { paddingHorizontal: gutter }]}>
        <View style={styles.tags}>
          {genreLabels(artist.genreSlugs, genres).map((t) => (
            <Tag key={t} label={t} />
          ))}
        </View>
        <Text variant="display" accessibilityRole="header">
          {artist.name}
        </Text>
        <Text variant="mono" tone="textMuted">
          {`${showsLabel} · ${venuesLabel}`}
        </Text>
        <View style={styles.section}>
          <Text variant="title" accessibilityRole="header">
            Próximo show
          </Text>
          {upcoming.length ? (
            upcoming.map((it, i) => (
              <EventCard
                key={it.event.id}
                variant="row"
                title={it.event.title}
                venueName={it.venue.name}
                area={it.venue.area}
                distanceKm={it.distanceKm}
                dateLabel={formatEventDate(it.event.startsAt)}
                priceLabel={formatPriceLabel(it.event.priceMin, it.event.priceMax, it.event.isFree)}
                coverKey={it.event.coverKey}
                saved={eventIds.includes(it.event.id)}
                divider={i < upcoming.length - 1}
                onPress={() => go(`/evento/${it.event.id}`)}
                onToggleSave={() => toggleEvent(it.event.id)}
              />
            ))
          ) : (
            <Text variant="bodySm" tone="textMuted">
              Nenhum show marcado por enquanto.
            </Text>
          )}
        </View>
        {playedAt.length ? (
          <View style={styles.section}>
            <Text variant="title" accessibilityRole="header">
              Já tocou em
            </Text>
            {playedAt.map((p, i) => (
              <VenueRow
                key={p.venue.id}
                name={p.venue.name}
                area={`${p.venue.area} · ${monthYear(p.lastPlayedAt)}`}
                coverKey={p.venue.coverKey}
                divider={i < playedAt.length - 1}
                onPress={() => go(`/casa/${p.venue.slug}`)}
              />
            ))}
          </View>
        ) : null}
      </View>
    </Frame>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md, paddingTop: space.sm },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  section: { gap: space.xs, marginTop: space.sm },
});

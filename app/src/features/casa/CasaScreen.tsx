import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';

import { effectiveTags } from '@/domain/accessTags';
import { formatEventDate, formatPriceLabel } from '@/domain/format';
import { useGenres, useVenue } from '@/data/queries';
import { AccessBadges } from '@/features/evento/AccessBadges';
import { Frame, StateShell, useGoBack } from '@/features/evento/Frame';
import { Hero } from '@/features/evento/Hero';
import { genreLabels, longDate, monthYear } from '@/features/evento/labels';
import { deepLink, openMaps } from '@/features/evento/linking';
import { useRecordView } from '@/state/useRecordView';
import { useFavorites } from '@/state/favorites';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { ArtistRow, Button, EventCard, Icon, IconButton, Tag, Text, useBreakpoint } from '@/ui';

async function shareVenueLink(name: string, slug: string): Promise<string> {
  const url = deepLink(`/casa/${slug}`);
  const msg = `Confere a programação de ${name} no Qual a boa?\n${url}`;
  if (Platform.OS === 'web') {
    const nav = (globalThis as { navigator?: { clipboard?: { writeText?: (t: string) => Promise<void> } } }).navigator;
    if (nav?.clipboard?.writeText) {
      try {
        await nav.clipboard.writeText(url);
        return 'Link da casa copiado!';
      } catch {
        /* fall through to Share */
      }
    }
  }
  try {
    await Share.share({ title: name, message: msg, url });
    return 'Link pronto para compartilhar.';
  } catch {
    return 'Não foi possível compartilhar agora.';
  }
}

export function CasaScreen({ slug }: { slug?: string }) {
  const { colors } = useTheme();
  const { gutter } = useBreakpoint();
  const router = useRouter();
  const goBack = useGoBack();
  const q = useVenue(slug);
  useRecordView('venue', q.data ? slug : undefined);
  const genres = useGenres().data;
  const venueIds = useFavorites((s) => s.venueIds);
  const eventIds = useFavorites((s) => s.eventIds);
  const toggleVenue = useFavorites((s) => s.toggleVenue);
  const toggleEvent = useFavorites((s) => s.toggleEvent);
  const [shareNote, setShareNote] = useState<string | null>(null);

  if (q.isPending && q.fetchStatus !== 'idle') return <StateShell state="loading" />;
  if (q.isError) return <StateShell state="error" onRetry={() => q.refetch()} />;
  if (!q.data) {
    return <StateShell state="missing" notFound={{ title: 'Casa não encontrada', message: 'Confira o endereço ou volte e procure outra casa.' }} />;
  }

  const { venue, upcoming, pastArtists } = q.data;
  const closed = venue.status === 'closed';
  const saved = venueIds.includes(venue.slug);
  const go = (path: string) => router.push(path as Href);
  const lastEvent = pastArtists.map((p) => p.lastPlayedAt).sort().pop();
  const address = [venue.address, venue.area, venue.city].filter(Boolean).join(' · ');

  const onShare = async () => {
    const status = await shareVenueLink(venue.name, venue.slug);
    setShareNote(status);
  };

  return (
    <Frame
      footer={
        closed ? undefined : (
          <Button label="Como chegar" icon="pin" fullWidth onPress={() => openMaps(venue.name, venue.lat, venue.lng)} style={styles.flex} />
        )
      }>
      <Hero
        coverKey={venue.coverKey}
        imageUrl={venue.imageUrl}
        onBack={goBack}
        actions={
          <>
            <IconButton icon="share" label="Compartilhar casa" variant="filled" onPress={() => void onShare()} testID="casa-share" />
            <IconButton
              icon={saved ? 'heartFilled' : 'heart'}
              label={saved ? 'Remover casa dos salvos' : 'Salvar casa'}
              selected={saved}
              variant="filled"
              color={saved ? colors.accent : undefined}
              onPress={() => toggleVenue(venue.slug)}
            />
          </>
        }
      />
      <View style={[styles.body, { paddingHorizontal: gutter }]}>
        {shareNote ? (
          <Text variant="caption" tone="accent" accessibilityLiveRegion="polite" testID="casa-share-status">
            {shareNote}
          </Text>
        ) : null}
        <Text variant="display" accessibilityRole="header">
          {venue.name}
        </Text>
        <Text variant="body" tone="textMuted">
          {address}
        </Text>
        {venue.hours || venue.priceRange ? (
          <View style={styles.hours}>
            <Icon name="clock" size={18} color="textMuted" />
            <Text variant="bodySm" tone="textMuted">
              {[venue.hours, venue.priceRange ? `Faixa ${venue.priceRange}` : undefined].filter(Boolean).join(' · ')}
            </Text>
          </View>
        ) : null}
        <View style={styles.tags}>
          {genreLabels(venue.genreSlugs, genres).map((t) => (
            <Tag key={t} label={t} />
          ))}
        </View>
        <AccessBadges tags={effectiveTags(venue, {})} />
        {venue.status === 'unverified' ? (
          <View accessibilityRole="alert" style={styles.notice}>
            <Icon name="clock" size={16} color="textMuted" />
            <Text variant="caption" tone="textMuted">
              Dados não confirmados
            </Text>
          </View>
        ) : null}
        {closed ? (
          <View accessibilityRole="alert" style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text variant="title">Encerrou as atividades</Text>
            <Text variant="bodySm" tone="textMuted">
              {lastEvent ? `O último evento foi em ${longDate(lastEvent)}. ` : ''}O histórico de artistas continua aqui.
            </Text>
          </View>
        ) : null}
        {pastArtists.length ? (
          <View style={styles.section}>
            <Text variant="title" accessibilityRole="header">
              Já passaram por aqui
            </Text>
            {pastArtists.map((p, i) => (
              <ArtistRow
                key={p.artist.id}
                name={p.artist.name}
                subtitle={genreLabels(p.artist.genreSlugs, genres).join(' · ') || undefined}
                playedLabel={monthYear(p.lastPlayedAt)}
                imageUri={p.artist.photoUrl}
                divider={i < pastArtists.length - 1}
                onPress={() => go(`/artista/${p.artist.slug}`)}
              />
            ))}
          </View>
        ) : null}
        {!closed && upcoming.length ? (
          <View style={styles.section}>
            <Text variant="title" accessibilityRole="header">
              Próximos eventos
            </Text>
            {upcoming.map((e, i) => (
              <EventCard
                key={e.id}
                variant="row"
                title={e.title}
                venueName={venue.name}
                dateLabel={formatEventDate(e.startsAt)}
                priceLabel={formatPriceLabel(e.priceMin, e.priceMax, e.isFree)}
                coverKey={e.coverKey}
                imageUrl={e.imageUrl}
                saved={eventIds.includes(e.id)}
                divider={i < upcoming.length - 1}
                onPress={() => go(`/evento/${e.id}`)}
                onToggleSave={() => toggleEvent(e.id)}
              />
            ))}
          </View>
        ) : !closed ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text variant="title">Sem programação futura por enquanto</Text>
            <Text variant="bodySm" tone="textMuted">
              Salve a casa para acompanhar quando novos eventos forem anunciados.
            </Text>
          </View>
        ) : null}
      </View>
    </Frame>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { gap: space.md, paddingTop: space.sm },
  hours: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  notice: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  card: { borderWidth: 1, borderRadius: radius.md, padding: space.lg, gap: space.xs },
  section: { gap: space.xs, marginTop: space.sm },
});

import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useArtistSearch, useGenres, useSearchEvents } from '@/data/queries';
import { minuteNow } from '@/features/explorar/clock';
import { ItemCard } from '@/features/explorar/ItemCard';
import { useLocation } from '@/state/location';
import { useSearchHistory } from '@/state/searchHistory';
import { maxContentWidth, space } from '@/theme/tokens';
import {
  ArtistRow,
  Button,
  Chip,
  EmptyState,
  ErrorState,
  EventCardSkeleton,
  ListRow,
  PressableScale,
  Screen,
  SearchBar,
  Text,
  VenueRow,
  useBreakpoint,
} from '@/ui';
import { buscaParams, KIND_LABELS, venueHits, type ResultKind } from './logic';

const DEBOUNCE_MS = 250;

function useDebounced(value: string, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="caption" tone="textMuted" accessibilityRole="header">
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

function Recents({ onPick }: { onPick: (q: string) => void }) {
  const recent = useSearchHistory((s) => s.recent).filter((x): x is string => typeof x === 'string');
  const remove = useSearchHistory((s) => s.remove);
  const clear = useSearchHistory((s) => s.clear);
  if (!recent.length) {
    return (
      <Text variant="body" tone="textMuted" testID="busca-hint">
        Busque por evento, casa ou artista. Suas buscas recentes aparecem aqui.
      </Text>
    );
  }
  return (
    <Section title="Buscas recentes">
      {recent.map((q, i) => (
        <View key={q} style={styles.recentRow}>
          <ListRow title={q} icon="clock" onPress={() => onPick(q)} divider={i < recent.length - 1} style={styles.flex} testID={`busca-recent-${i}`} />
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Remover ${q} das buscas recentes`}
            onPress={() => remove(q)}
            style={styles.remove}>
            <Text variant="bodySm" tone="textMuted">
              Remover
            </Text>
          </PressableScale>
        </View>
      ))}
      <Button label="Limpar histórico" variant="ghost" onPress={clear} testID="busca-clear-history" />
    </Section>
  );
}

/** Busca: one field, results grouped by Eventos / Casas / Artistas, and recent searches. */
export function BuscaScreen({ initialQuery = '' }: { initialQuery?: string }) {
  const { gutter } = useBreakpoint();
  const [text, setText] = useState(initialQuery);
  const [kind, setKind] = useState<ResultKind>('tudo');
  const query = useDebounced(text.trim(), DEBOUNCE_MS);
  const location = useLocation((s) => s.location);
  const addRecent = useSearchHistory((s) => s.add);
  const genres = useGenres().data;
  const genreLabel = useMemo(() => Object.fromEntries((genres ?? []).map((g) => [g.slug, g.label])), [genres]);

  const now = minuteNow();
  const params = useMemo(() => buscaParams(query, location, now), [query, location, now]);
  const events = useSearchEvents(params);
  const artists = useArtistSearch(query);
  const active = query.length > 0;

  const eventItems = useMemo(() => (active ? (events.data?.pages.flatMap((p) => p.items) ?? []) : []), [active, events.data]);
  const venues = useMemo(() => venueHits(eventItems, query), [eventItems, query]);
  const artistItems = active ? (artists.data ?? []) : [];
  const counts = { tudo: eventItems.length + venues.length + artistItems.length, eventos: eventItems.length, casas: venues.length, artistas: artistItems.length };

  // Remember searches that found something when the user leaves the screen (or submits).
  const lastUseful = useRef('');
  useEffect(() => {
    if (active && counts.tudo > 0) lastUseful.current = query;
  }, [active, counts.tudo, query]);
  useEffect(() => () => {
    if (lastUseful.current) addRecent(lastUseful.current);
  }, [addRecent]);

  const remember = () => {
    if (text.trim()) addRecent(text.trim());
  };
  const go = (href: Parameters<typeof router.push>[0]) => {
    remember();
    router.push(href);
  };

  const loading = active && (events.isLoading || (artists.isLoading && artists.fetchStatus !== 'idle'));
  const show = (k: ResultKind) => kind === 'tudo' || kind === k;

  return (
    <Screen bleed edges={['top', 'bottom']} testID="busca-screen">
      <View style={[styles.inner, { paddingHorizontal: gutter }]}>
        <View style={styles.top}>
          <SearchBar
            style={styles.flex}
            value={text}
            onChangeText={setText}
            onSubmit={remember}
            autoFocus
            placeholder="Evento, casa ou artista"
            label="Buscar eventos, casas ou artistas"
            testID="busca-input"
          />
          <PressableScale accessibilityRole="button" accessibilityLabel="Cancelar busca" onPress={close} style={styles.cancel} testID="busca-cancel">
            <Text variant="body">Cancelar</Text>
          </PressableScale>
        </View>

        {active ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kinds} style={styles.kindsBar}>
            {(Object.keys(KIND_LABELS) as ResultKind[]).map((k) => (
              <Chip
                key={k}
                label={KIND_LABELS[k]}
                count={k === 'tudo' || loading ? undefined : counts[k]}
                selected={kind === k}
                onPress={() => setKind(k)}
                testID={`busca-kind-${k}`}
              />
            ))}
          </ScrollView>
        ) : null}

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {!active ? (
            <Recents onPick={setText} />
          ) : events.isError ? (
            <ErrorState onRetry={() => void events.refetch()} />
          ) : loading ? (
            <View testID="busca-loading" style={styles.section}>
              {[0, 1, 2].map((i) => (
                <EventCardSkeleton key={i} variant="row" />
              ))}
            </View>
          ) : counts.tudo === 0 ? (
            <EmptyState
              title="Nada encontrado"
              message={`Não achamos nada para "${query}". Confira a grafia ou procure pelo estilo nos filtros.`}
              actionLabel="Abrir filtros"
              onAction={() => router.push('/filtros')}
            />
          ) : (
            <>
              {show('casas') && venues.length ? (
                <Section title="Casas">
                  {venues.map((h, i) => (
                    <VenueRow
                      key={h.venue.id}
                      name={h.venue.name}
                      area={h.venue.area}
                      distanceKm={h.distanceKm}
                      genres={h.venue.genreSlugs.map((g) => genreLabel[g]).filter(Boolean)}
                      coverKey={h.venue.coverKey}
                      divider={i < venues.length - 1}
                      onPress={() => go(`/casa/${h.venue.slug}`)}
                      testID={`busca-venue-${h.venue.slug}`}
                    />
                  ))}
                </Section>
              ) : null}
              {show('eventos') && eventItems.length ? (
                <Section title="Eventos">
                  {eventItems.map((it, i) => (
                    <ItemCard key={it.event.id} item={it} variant="row" divider={i < eventItems.length - 1} />
                  ))}
                </Section>
              ) : null}
              {show('artistas') && artistItems.length ? (
                <Section title="Artistas">
                  {artistItems.map((a, i) => (
                    <ArtistRow
                      key={a.id}
                      name={a.name}
                      subtitle={a.genreSlugs.map((g) => genreLabel[g]).filter(Boolean).join(' · ') || undefined}
                      imageUri={a.photoUrl}
                      divider={i < artistItems.length - 1}
                      onPress={() => go(`/artista/${a.slug}`)}
                      testID={`busca-artist-${a.slug}`}
                    />
                  ))}
                </Section>
              ) : null}
              {kind !== 'tudo' && counts[kind] === 0 ? (
                <Text variant="body" tone="textMuted">
                  Nenhum resultado em {KIND_LABELS[kind].toLowerCase()} para &quot;{query}&quot;.
                </Text>
              ) : null}
            </>
          )}
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  inner: { flex: 1, width: '100%', maxWidth: maxContentWidth, alignSelf: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.md },
  flex: { flex: 1 },
  cancel: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.xs },
  kindsBar: { flexGrow: 0, marginTop: space.md },
  kinds: { gap: space.sm },
  body: { gap: space.xl, paddingTop: space.lg, paddingBottom: space.xxxl },
  section: { gap: space.xs },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  remove: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.sm },
});

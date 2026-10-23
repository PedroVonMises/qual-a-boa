import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useSearchEvents } from '@/data/queries';
import { toSearchParams } from '@/domain/filters';
import { useFilters } from '@/state/filters';
import { useLocation } from '@/state/location';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space } from '@/theme/tokens';
import { ErrorState, IconButton, EventCardSkeleton, SearchBar, Text, useBreakpoint } from '@/ui';
import { VenueMap } from './VenueMap';
import { VenuePanel } from './VenuePanel';
import { groupByVenue } from './pins';

const MAP_RADIUS_KM = 25;
const MAP_LIMIT = 100;

export function MapaScreen({ now }: { now?: string }) {
  const router = useRouter();
  const { colors } = useTheme();
  const { isLarge } = useBreakpoint();
  const location = useLocation((s) => s.location);
  const isCustom = useLocation((s) => s.isCustom);
  const filters = useFilters((s) => s.filters);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const nowIso = useMemo(() => now ?? new Date().toISOString(), [now]);

  const params = useMemo(
    () => ({
      ...toSearchParams({ ...filters, query: query || filters.query, radiusKm: filters.radiusKm }, location, nowIso),
      radiusKm: Math.max(filters.radiusKm, MAP_RADIUS_KM),
      limit: MAP_LIMIT,
    }),
    [filters, query, location, nowIso],
  );
  const search = useSearchEvents(params);
  const items = useMemo(() => search.data?.pages.flatMap((p) => p.items) ?? [], [search.data]);
  const pins = useMemo(() => groupByVenue(items), [items]);
  const visible = selectedId ? pins.filter((p) => p.venue.id === selectedId) : pins;

  const header = (
    <View style={styles.search}>
      <SearchBar value={query} onChangeText={setQuery} placeholder="Buscar nesta área" style={styles.grow} />
      <IconButton icon="filter" label="Filtros" variant="accent" onPress={() => router.push('/filtros')} />
    </View>
  );
  const panel = search.isError ? (
    <ErrorState inline message="Não foi possível carregar as casas." onRetry={() => search.refetch()} />
  ) : search.isPending ? (
    <EventCardSkeleton variant="row" />
  ) : (
    <>
      {selectedId ? (
        <Text variant="bodySm" tone="accent" accessibilityRole="button" onPress={() => setSelectedId(null)} style={styles.clear}>
          Ver todas as casas
        </Text>
      ) : null}
      <VenuePanel
        pins={visible}
        now={nowIso}
        onOpenEvent={(id) => router.push(`/evento/${id}`)}
        onOpenVenue={(slug) => router.push(`/casa/${slug}`)}
      />
    </>
  );
  const map = (
    <VenueMap
      pins={pins}
      selectedId={selectedId}
      onSelect={setSelectedId}
      center={location}
      userLocation={isCustom ? location : undefined}
    />
  );

  if (isLarge) {
    return (
      <View style={[styles.root, styles.split, { backgroundColor: colors.background }]} testID="mapa-split">
        <View style={[styles.side, { borderRightColor: colors.border }]}>
          {header}
          {panel}
        </View>
        <View style={styles.grow}>{map}</View>
      </View>
    );
  }
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {map}
      <View style={styles.floating}>{header}</View>
      <View style={[styles.sheet, { backgroundColor: colors.surface }]} testID="mapa-sheet">
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        {panel}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  split: { flexDirection: 'row' },
  side: { width: 420, padding: space.lg, borderRightWidth: 1 },
  grow: { flex: 1 },
  search: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  floating: { position: 'absolute', left: space.lg, right: space.lg, top: space.xxxl },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '45%',
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2 },
  clear: { minHeight: 44, textAlignVertical: 'center' },
});

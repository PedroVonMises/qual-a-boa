import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { BackHandler, Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { useSearchEvents } from '@/data/queries';
import { RADIUS_OPTIONS, toSearchParams } from '@/domain/filters';
import { rankItems } from '@/domain/recommend';
import { useRecoContext } from '@/features/explorar/useSearch';
import { RadiusSlider } from '@/features/filtros';
import { useFilters } from '@/state/filters';
import { refreshDeviceLocation } from '@/lib/location';
import { useLocation } from '@/state/location';
import { useTheme } from '@/theme/ThemeProvider';
import { maxContentWidth, motion, space } from '@/theme/tokens';
import {
  Button,
  EmptyState,
  ErrorState,
  EventCardSkeleton,
  IconButton,
  MAP_SHEET_PEEK,
  MAP_SHEET_TABLET_MAX_WIDTH,
  MapSheet,
  MapSheetScrollView,
  SearchBar,
  snapHeights,
  Text,
  useBreakpoint,
} from '@/ui';
import { useInsets } from '@/ui/useInsets';
import { useReduceMotion } from '@/ui/useReduceMotion';
import { useMapSheet } from './mapSheetStore';
import { VenueMap } from './VenueMap';
import { VenuePanel, VenuePanelHeader } from './VenuePanel';
import { groupByVenue } from './pins';

const MAP_LIMIT = 100;
/** Fade of the floating top row when the list goes full screen. */
const TOP_FADE_MS = 200;

/** >= 1024: list column beside the map, the map alone, or the list alone (up to maxContentWidth). */
type LargeMode = 'split' | 'map' | 'list';

export function MapaScreen({ now }: { now?: string }) {
  const router = useRouter();
  const { colors } = useTheme();
  const { isLarge, breakpoint, width = 0, height = 0 } = useBreakpoint();
  const insets = useInsets();
  const reduce = useReduceMotion();
  const location = useLocation((s) => s.location);
  const isCustom = useLocation((s) => s.isCustom);
  const filters = useFilters((s) => s.filters);
  const setFilters = useFilters((s) => s.set);
  const sheetIndex = useMapSheet((s) => s.index);
  const setSheetIndex = useMapSheet((s) => s.setIndex);
  const [largeMode, setLargeMode] = useState<LargeMode>('split');
  const [rootH, setRootH] = useState(0);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const nowIso = useMemo(() => now ?? new Date().toISOString(), [now]);

  // Exactly the radius the user chose (no minimum on the map).
  const params = useMemo(
    () => ({
      ...toSearchParams({ ...filters, query: query || filters.query }, location, nowIso),
      radiusKm: filters.radiusKm,
      limit: MAP_LIMIT,
    }),
    [filters, query, location, nowIso],
  );
  const search = useSearchEvents(params);
  const items = useMemo(() => search.data?.pages.flatMap((p) => p.items) ?? [], [search.data]);
  const recommended = filters.sort === 'recommended';
  const ctx = useRecoContext(filters.radiusKm);
  const ranked = useMemo(() => (recommended ? rankItems(items, ctx, Date.parse(nowIso)) : undefined), [recommended, items, ctx, nowIso]);
  const pins = useMemo(() => groupByVenue(items, ranked), [items, ranked]);
  const visible = selectedId ? pins.filter((p) => p.venue.id === selectedId) : pins;
  const total = visible.reduce((n, p) => n + p.items.length, 0);
  const nextRadius = RADIUS_OPTIONS.find((r) => r > filters.radiusKm);

  const goHome = useCallback(() => router.navigate('/'), [router]);

  // Android back: the full list first steps back to the split view; otherwise go to Início (never leave the app).
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (!isLarge && useMapSheet.getState().index === 2) {
          useMapSheet.getState().setIndex(1);
          return true;
        }
        goHome();
        return true;
      });
      return () => sub.remove();
    }, [goHome, isLarge]),
  );

  const onSelectPin = (id: string) => {
    setSelectedId(id);
    if (!isLarge && useMapSheet.getState().index === 0) setSheetIndex(1);
  };

  const back = <IconButton icon="chevronLeft" label="Voltar para o Início" variant="filled" onPress={goHome} />;
  const searchRow = (withBack: boolean) => (
    <View style={styles.row}>
      {withBack ? back : null}
      <SearchBar value={query} onChangeText={setQuery} placeholder="Buscar nesta área" style={styles.grow} />
      <IconButton icon="filter" label="Filtros" variant="accent" onPress={() => router.push('/filtros')} />
    </View>
  );

  const listHead = (
    <>
      <VenuePanelHeader total={search.isPending || search.isError ? undefined : total} />
      <RadiusSlider value={filters.radiusKm} onChange={(radiusKm) => setFilters({ radiusKm })} />
    </>
  );
  const emptyState = (
    <EmptyState
      title="Nenhuma casa aberta por aqui"
      message={nextRadius ? 'Ajuste os filtros ou aumente o raio.' : 'Ajuste os filtros ou busque outra área.'}
      actionLabel={nextRadius ? `Aumente o raio para ${nextRadius} km` : undefined}
      onAction={nextRadius ? () => setFilters({ radiusKm: nextRadius }) : undefined}
    />
  );
  const listBody = (inSheet: boolean): ReactNode =>
    search.isError ? (
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
          showHeader={false}
          scroll={inSheet ? MapSheetScrollView : undefined}
          empty={emptyState}
          onOpenEvent={(id) => router.push(`/evento/${id}`)}
          onOpenVenue={(slug) => router.push(`/casa/${slug}`)}
        />
      </>
    );

  const mapFor = (bottomInset: number, locate: boolean) => (
    <VenueMap
      pins={pins}
      selectedId={selectedId}
      onSelect={onSelectPin}
      center={location}
      userLocation={isCustom ? location : undefined}
      onLocate={locate ? () => void refreshDeviceLocation(true) : undefined}
      fitKey={pins.map((p) => p.venue.id).join(',')}
      radiusKm={filters.radiusKm}
      bottomInset={bottomInset}
    />
  );

  // Fade the floating top row out when the list is full screen (the row then sits at the top of the sheet).
  const listFull = sheetIndex === 2;
  const topFade = useAnimatedStyle(() => ({
    opacity: withTiming(listFull ? 0 : 1, { duration: reduce ? motion.reducedFadeMs : TOP_FADE_MS }),
  }));

  if (isLarge) {
    const toggles =
      largeMode === 'split' ? (
        <>
          <Button variant="secondary" label="Ocultar lista" onPress={() => setLargeMode('map')} />
          <Button variant="secondary" label="Só lista" onPress={() => setLargeMode('list')} />
        </>
      ) : (
        <Button variant="secondary" label="Mostrar mapa" icon="map" onPress={() => setLargeMode('split')} />
      );
    return (
      <View style={[styles.root, styles.split, { backgroundColor: colors.background }]} testID="mapa-split">
        {largeMode !== 'map' ? (
          <View
            style={[styles.side, largeMode === 'list' ? styles.sideWide : null, { borderRightColor: colors.border }]}
            testID="mapa-column">
            <View style={styles.row}>
              {back}
              <View style={styles.grow} />
              {toggles}
            </View>
            <View style={styles.gapTop}>{searchRow(false)}</View>
            {listHead}
            {listBody(false)}
          </View>
        ) : null}
        {largeMode !== 'list' ? (
          <View style={styles.grow}>
            {mapFor(0, true)}
            {largeMode === 'map' ? (
              <View style={[styles.row, styles.mapOnlyBar]}>
                {back}
                <Button variant="secondary" label="Mostrar lista" onPress={() => setLargeMode('split')} />
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  }

  const landscapePhone = width > height && height > 0 && height < 600;
  const splitFraction = landscapePhone ? 0.6 : 0.5;
  const heights = snapHeights(rootH || height, splitFraction, insets.top);
  const sheetTop = listFull ? heights[1] : heights[sheetIndex];
  const pillBottom = sheetIndex === 0 ? MAP_SHEET_PEEK + space.md : space.lg;

  return (
    <View
      style={[styles.root, { backgroundColor: colors.background }]}
      onLayout={(e: LayoutChangeEvent) => setRootH(e.nativeEvent.layout.height)}>
      {mapFor(sheetTop, !listFull)}
      <Animated.View
        pointerEvents={listFull ? 'none' : 'box-none'}
        aria-hidden={listFull}
        accessibilityElementsHidden={listFull}
        importantForAccessibility={listFull ? 'no-hide-descendants' : 'auto'}
        style={[styles.floating, { top: insets.top + space.md }, topFade]}
        testID="mapa-top-row">
        {searchRow(true)}
      </Animated.View>
      <MapSheet
        index={sheetIndex}
        onIndexChange={setSheetIndex}
        splitFraction={splitFraction}
        maxWidth={breakpoint === 'md' ? MAP_SHEET_TABLET_MAX_WIDTH : undefined}
        testID="mapa-sheet">
        {listFull ? <View style={styles.sheetTop}>{searchRow(true)}</View> : null}
        <View style={styles.sheetPad}>{listHead}</View>
        <View style={[styles.sheetPad, styles.grow]}>{listBody(true)}</View>
      </MapSheet>
      {sheetIndex !== 1 ? (
        <View pointerEvents="box-none" style={[styles.pill, { bottom: pillBottom }]}>
          {sheetIndex === 0 ? (
            <Button label="Ver lista" icon="arrowUp" onPress={() => setSheetIndex(2)} testID="mapa-pill" />
          ) : (
            <Button label="Ver mapa" icon="map" onPress={() => setSheetIndex(0)} testID="mapa-pill" />
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  split: { flexDirection: 'row', justifyContent: 'center' },
  side: { width: 420, padding: space.lg, borderRightWidth: 1 },
  sideWide: { width: undefined, flex: 1, maxWidth: maxContentWidth },
  grow: { flex: 1 },
  gapTop: { marginTop: space.md },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  floating: { position: 'absolute', left: space.lg, right: space.lg },
  mapOnlyBar: { position: 'absolute', top: space.lg, left: space.lg },
  sheetTop: { paddingHorizontal: space.lg, paddingBottom: space.sm },
  sheetPad: { paddingHorizontal: space.xl },
  pill: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  clear: { minHeight: 44, textAlignVertical: 'center' },
});

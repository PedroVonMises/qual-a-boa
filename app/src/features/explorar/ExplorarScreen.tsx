import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { countActiveFilters } from '@/domain/filters';
import { QuandoSheet } from '@/features/quando';
import { useFilters } from '@/state/filters';
import { useSearchHistory } from '@/state/searchHistory';
import { maxContentWidth, space } from '@/theme/tokens';
import { ErrorState, EventCardSkeleton, ListRow, Screen, TAB_BAR_HEIGHT, useBreakpoint } from '@/ui';
import { AreaSheet } from './AreaSheet';
import { EmptyResults } from './EmptyResults';
import { Header } from './Header';
import { ItemCard } from './ItemCard';
import { ResultBar } from './ResultBar';
import { Shelves } from './Shelves';
import { useFilteredSearch } from './useSearch';
import { useRecordGenreFilters } from './useTasteProfile';

/** True when the shelves give way to a result list. */
export function useResultMode(): boolean {
  const filters = useFilters((s) => s.filters);
  return countActiveFilters(filters) > 0;
}

function Body({ resultMode, isLoading, isError, refetch, empty }: {
  resultMode: boolean;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  empty: boolean;
}) {
  if (!resultMode) return <Shelves />;
  if (isError) return <ErrorState onRetry={refetch} />;
  if (isLoading) {
    return (
      <View testID="results-loading" style={styles.skeletons}>
        {[0, 1, 2, 3].map((i) => (
          <EventCardSkeleton key={i} variant="row" />
        ))}
      </View>
    );
  }
  return empty ? <EmptyResults /> : null;
}

/** Opens the full search (events, venues and artists) for `text`. */
export function openBusca(text: string) {
  const q = text.trim();
  if (q) useSearchHistory.getState().add(q);
  router.push({ pathname: '/busca', params: q ? { q } : {} });
}

function SearchAllRow() {
  const query = useFilters((s) => s.filters.query.trim());
  if (!query) return null;
  return (
    <ListRow
      title={`Buscar "${query}" em casas e artistas`}
      icon="search"
      chevron
      onPress={() => openBusca(query)}
      testID="search-all"
    />
  );
}

export function ExplorarScreen() {
  const [areaOpen, setAreaOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const resultMode = useResultMode();
  useRecordGenreFilters();
  const { items, scored, total, isLoading, isError, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } = useFilteredSearch();
  const { breakpoint, gutter } = useBreakpoint();
  const columns = breakpoint === 'lg' ? 3 : breakpoint === 'md' ? 2 : 1;
  const reasons = useMemo(() => {
    const out: Record<string, string> = {};
    for (const s of scored ?? []) if (s.reasons[0]) out[s.item.event.id] = s.reasons[0].text;
    return out;
  }, [scored]);

  return (
    <Screen bleed testID="explorar-screen">
      <View style={styles.inner}>
        <FlashList
          key={`cols-${columns}`}
          data={resultMode ? items : []}
          numColumns={columns}
          keyExtractor={(i) => i.event.id}
          renderItem={({ item, index }) => <ItemCard item={item} variant="row" reason={reasons[item.event.id]} divider={index < items.length - columns} />}
          ListHeaderComponent={
            <View>
              <Header onPickArea={() => setAreaOpen(true)} onPickDate={() => setDateOpen(true)} onSubmitSearch={openBusca} />
              {resultMode ? <SearchAllRow /> : null}
              {resultMode ? <ResultBar total={total} /> : null}
            </View>
          }
          ListEmptyComponent={
            <Body
              resultMode={resultMode}
              isLoading={isLoading}
              isError={isError}
              refetch={() => void refetch()}
              empty={!isLoading && !isError && items.length === 0}
            />
          }
          ListFooterComponent={isFetchingNextPage ? <EventCardSkeleton variant="row" /> : null}
          onEndReached={() => {
            if (resultMode && hasNextPage && !isFetchingNextPage) void fetchNextPage();
          }}
          onEndReachedThreshold={0.6}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: resultMode ? gutter : 0,
            paddingBottom: TAB_BAR_HEIGHT + space.xxxl,
          }}
        />
      </View>
      <AreaSheet visible={areaOpen} onClose={() => setAreaOpen(false)} />
      <QuandoSheet visible={dateOpen} onClose={() => setDateOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  inner: { flex: 1, width: '100%', maxWidth: maxContentWidth, alignSelf: 'center' },
  skeletons: { gap: space.sm },
});

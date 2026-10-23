import { FlashList } from '@shopify/flash-list';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { countActiveFilters } from '@/domain/filters';
import { useFilters } from '@/state/filters';
import { maxContentWidth, space } from '@/theme/tokens';
import { ErrorState, EventCardSkeleton, Screen, TAB_BAR_HEIGHT, useBreakpoint } from '@/ui';
import { AreaSheet } from './AreaSheet';
import { EmptyResults } from './EmptyResults';
import { Header } from './Header';
import { ItemCard } from './ItemCard';
import { ResultBar } from './ResultBar';
import { Shelves } from './Shelves';
import { useFilteredSearch } from './useSearch';

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

export function ExplorarScreen() {
  const [areaOpen, setAreaOpen] = useState(false);
  const resultMode = useResultMode();
  const { items, total, isLoading, isError, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } = useFilteredSearch();
  const { breakpoint, gutter } = useBreakpoint();
  const columns = breakpoint === 'lg' ? 3 : breakpoint === 'md' ? 2 : 1;

  return (
    <Screen bleed testID="explorar-screen">
      <View style={styles.inner}>
        <FlashList
          key={`cols-${columns}`}
          data={resultMode ? items : []}
          numColumns={columns}
          keyExtractor={(i) => i.event.id}
          renderItem={({ item, index }) => <ItemCard item={item} variant="row" divider={index < items.length - columns} />}
          ListHeaderComponent={
            <View>
              <Header onPickArea={() => setAreaOpen(true)} />
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  inner: { flex: 1, width: '100%', maxWidth: maxContentWidth, alignSelf: 'center' },
  skeletons: { gap: space.sm },
});

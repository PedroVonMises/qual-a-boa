import { StyleSheet, View } from 'react-native';

import { useSearchEvents } from '@/data/queries';
import { defaultFilters, type FilterState } from '@/domain/filters';
import type { SearchItem } from '@/domain/types';
import { useFilters } from '@/state/filters';
import { space } from '@/theme/tokens';
import { EventCardSkeleton, Shelf, useBreakpoint } from '@/ui';
import { ItemCard } from './ItemCard';
import { LeadGrid } from './LeadGrid';
import { useSearchParams } from './useSearch';

interface ShelfDef {
  key: string;
  title: string;
  patch: Partial<FilterState>;
}

export const SHELVES: ShelfDef[] = [
  { key: 'hoje', title: 'Hoje à noite', patch: { dateRange: 'hoje', sort: 'date' } },
  { key: 'fds', title: 'Este fim de semana', patch: { dateRange: 'fim-de-semana', sort: 'popularity' } },
  { key: 'barato', title: 'Até R$ 40', patch: { priceMax: 40, sort: 'price' } },
  { key: 'perto', title: 'Perto de você', patch: { radiusKm: 3, sort: 'distance' } },
];

function ShelfSection({ def, grid }: { def: ShelfDef; grid: boolean }) {
  const radiusKm = useFilters((s) => s.filters.radiusKm);
  const set = useFilters((s) => s.set);
  const filters: FilterState = { ...defaultFilters, radiusKm, ...def.patch };
  const q = useSearchEvents(useSearchParams(filters, 10));
  const items: SearchItem[] = q.data?.pages[0]?.items ?? [];
  const { gutter } = useBreakpoint();

  if (q.isLoading) {
    return (
      <View testID={`shelf-${def.key}-loading`} style={[styles.skeletons, { paddingHorizontal: gutter }]}>
        <EventCardSkeleton />
        <EventCardSkeleton />
      </View>
    );
  }
  if (items.length === 0) return null;
  const onAction = () => set(def.patch);
  if (grid) return <LeadGrid title={def.title} items={items} onAction={onAction} />;
  return (
    <Shelf
      title={def.title}
      data={items}
      gutter={gutter}
      actionLabel="ver todos"
      onAction={onAction}
      keyExtractor={(i) => i.event.id}
      renderItem={({ item }) => <ItemCard item={item} />}
    />
  );
}

export function Shelves() {
  const { isLarge } = useBreakpoint();
  return (
    <View style={styles.wrap}>
      {SHELVES.map((def, i) => (
        <ShelfSection key={def.key} def={def} grid={isLarge && i === 0} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xxxl },
  skeletons: { flexDirection: 'row', gap: space.md },
});

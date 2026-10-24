import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useSearchEvents } from '@/data/queries';
import { defaultFilters, type FilterState } from '@/domain/filters';
import type { SearchItem } from '@/domain/types';
import { useFilters } from '@/state/filters';
import { space } from '@/theme/tokens';
import { EventCardSkeleton, Shelf, useBreakpoint } from '@/ui';
import { ItemCard } from './ItemCard';
import { LeadGrid } from './LeadGrid';
import { useRecommendedSearch, useSearchParams } from './useSearch';

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

export const FOR_YOU_COUNT = 10;

/** First shelf: the top of the on-device ranking. On large screens the top item is the lead card. */
function ForYouShelf({ grid }: { grid: boolean }) {
  const set = useFilters((s) => s.set);
  const q = useRecommendedSearch(FOR_YOU_COUNT);
  const { gutter } = useBreakpoint();
  const reasons = useMemo(() => {
    const out: Record<string, string> = {};
    for (const s of q.scored) if (s.reasons[0]) out[s.item.event.id] = s.reasons[0].text;
    return out;
  }, [q.scored]);

  if (q.isLoading) {
    return (
      <View testID="shelf-para-voce-loading" style={[styles.skeletons, { paddingHorizontal: gutter }]}>
        <EventCardSkeleton />
        <EventCardSkeleton />
      </View>
    );
  }
  if (q.items.length === 0) return null;
  // "ver todos" widens the radius, which switches to the full ranked list (sorted "Para você").
  const onAction = () => set({ radiusKm: 25, sort: 'recommended' });
  if (grid) return <LeadGrid title="Para você" items={q.items} reasons={reasons} onAction={onAction} />;
  return (
    <Shelf
      title="Para você"
      data={q.items}
      gutter={gutter}
      actionLabel="ver todos"
      onAction={onAction}
      keyExtractor={(i) => i.event.id}
      renderItem={({ item }) => <ItemCard item={item} reason={reasons[item.event.id]} />}
    />
  );
}

export function Shelves() {
  const { isLarge } = useBreakpoint();
  return (
    <View style={styles.wrap}>
      <ForYouShelf grid={isLarge} />
      {SHELVES.map((def) => (
        <ShelfSection key={def.key} def={def} grid={false} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xxxl },
  skeletons: { flexDirection: 'row', gap: space.md },
});

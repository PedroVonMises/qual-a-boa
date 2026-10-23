import { StyleSheet, View } from 'react-native';

import type { SortKey } from '@/domain/types';
import { useFilters } from '@/state/filters';
import { space } from '@/theme/tokens';
import { SegmentedControl, Text, useBreakpoint } from '@/ui';

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'distance', label: 'Distância' },
  { value: 'price', label: 'Preço' },
  { value: 'date', label: 'Data' },
  { value: 'popularity', label: 'Popularidade' },
];

export function countLabel(n: number): string {
  return n === 1 ? '1 evento' : `${n} eventos`;
}

/** Result count + sort control shown above the vertical list. */
export function ResultBar({ total }: { total?: number }) {
  const sort = useFilters((s) => s.filters.sort);
  const set = useFilters((s) => s.set);
  const { gutter } = useBreakpoint();
  return (
    <View style={[styles.wrap, { paddingHorizontal: gutter }]}>
      <Text variant="title" accessibilityRole="header" accessibilityLiveRegion="polite" testID="result-count">
        {total === undefined ? 'Resultados' : countLabel(total)}
      </Text>
      <SegmentedControl label="Ordenar por" options={SORTS} value={sort} onChange={(v) => set({ sort: v })} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md, paddingBottom: space.md },
});

import { StyleSheet, View } from 'react-native';

import { useGenres } from '@/data/queries';
import { tagLabel } from '@/domain/accessTags';
import { RADIUS_OPTIONS, type FilterState } from '@/domain/filters';
import { useFilters } from '@/state/filters';
import { Button, EmptyState } from '@/ui';

export function nextRadius(current: number): number | null {
  return RADIUS_OPTIONS.find((r) => r > current && r >= 10) ?? null;
}

function describe(f: FilterState, genreLabels: string[]): string {
  const parts: string[] = [];
  if (genreLabels.length) parts.push(`de ${genreLabels.join(', ')}`);
  if (f.tags.length) parts.push(`com ${f.tags.map(tagLabel).join(' e ')}`);
  if (f.priceMax === 0) parts.push('grátis');
  else if (f.priceMax != null) parts.push(`até R$ ${f.priceMax}`);
  if (f.query.trim()) parts.push(`para "${f.query.trim()}"`);
  parts.push(`a ${f.radiusKm} km`);
  return parts.join(' ');
}

/** "Nada aceso por aqui" with the two recovery actions. */
export function EmptyResults() {
  const filters = useFilters((s) => s.filters);
  const set = useFilters((s) => s.set);
  const reset = useFilters((s) => s.reset);
  const { data: genres } = useGenres();
  const labels = (genres ?? []).filter((g) => filters.genreSlugs.includes(g.slug)).map((g) => g.label);
  const bigger = nextRadius(filters.radiusKm);
  return (
    <View style={styles.wrap}>
      <EmptyState
        title="Nada aceso por aqui"
        message={`Não achamos eventos ${describe(filters, labels)}. Tente abrir o raio${filters.tags.length ? ', tirar um selo' : ''} ou tirar um filtro.`}
        actionLabel={bigger ? `Aumentar o raio para ${bigger} km` : undefined}
        onAction={bigger ? () => set({ radiusKm: bigger as FilterState['radiusKm'] }) : undefined}
      />
      <Button label="Limpar filtros" variant="ghost" onPress={reset} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
});

import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAreas, useGenres } from '@/data/queries';
import { RADIUS_OPTIONS, type DateRange } from '@/domain/filters';
import { useFilters } from '@/state/filters';
import { space } from '@/theme/tokens';
import { Chip, Text } from '@/ui';
import { ArtistPicker } from './ArtistPicker';
import { PriceStepper } from './PriceStepper';

const DATES: { value: DateRange; label: string }[] = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'fim-de-semana', label: 'Fim de semana' },
  { value: 'qualquer', label: 'Qualquer' },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="title" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

export function Sections() {
  const filters = useFilters((s) => s.filters);
  const set = useFilters((s) => s.set);
  const toggleGenre = useFilters((s) => s.toggleGenre);
  const { data: genres } = useGenres();
  const { data: areas } = useAreas();
  return (
    <View style={styles.wrap}>
      <Section title="Gênero">
        <View style={styles.chips}>
          {(genres ?? []).map((g) => (
            <Chip key={g.slug} label={g.label} selected={filters.genreSlugs.includes(g.slug)} onPress={() => toggleGenre(g.slug)} />
          ))}
        </View>
      </Section>
      <Section title="Região">
        <View style={styles.chips}>
          {(areas ?? []).map((a) => (
            <Chip key={a} label={a} selected={filters.area === a} onPress={() => set({ area: filters.area === a ? null : a })} />
          ))}
        </View>
      </Section>
      <Section title="Preço">
        <PriceStepper value={filters.priceMax} onChange={(priceMax) => set({ priceMax })} />
      </Section>
      <Section title="Distância">
        <View style={styles.chips}>
          {RADIUS_OPTIONS.map((r) => (
            <Chip key={r} label={`${r} km`} selected={filters.radiusKm === r} onPress={() => set({ radiusKm: r })} />
          ))}
        </View>
      </Section>
      <Section title="Data">
        <View style={styles.chips}>
          {DATES.map((d) => (
            <Chip key={d.value} label={d.label} selected={filters.dateRange === d.value} onPress={() => set({ dateRange: d.value })} />
          ))}
        </View>
      </Section>
      <Section title="Artista">
        <ArtistPicker />
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xxl },
  section: { gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});

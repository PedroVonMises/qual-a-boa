import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useGenres } from '@/data/queries';
import { countActiveFilters, defaultFilters } from '@/domain/filters';
import { useFilters } from '@/state/filters';
import { useLocation } from '@/state/location';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { Chip, Icon, IconButton, PressableScale, SearchBar, Text, useBreakpoint } from '@/ui';

const DEBOUNCE_MS = 300;

/** Debounced mirror of `filters.query`; external changes (reset) flow back into the field. */
function useSearchText() {
  const query = useFilters((s) => s.filters.query);
  const set = useFilters((s) => s.set);
  // `draft` only exists while the user is typing; otherwise the store value is shown (so resets flow in).
  const [draft, setDraft] = useState<string | null>(null);
  useEffect(() => {
    if (draft === null) return;
    const t = setTimeout(() => {
      set({ query: draft });
      setDraft(null);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [draft, set]);
  return [draft ?? query, setDraft] as const;
}

export function FilterButton() {
  const { colors } = useTheme();
  const filters = useFilters((s) => s.filters);
  const count = countActiveFilters({ ...filters, query: '', sort: defaultFilters.sort });
  return (
    <View>
      <IconButton
        icon="filter"
        variant="filled"
        label={count ? `Filtros, ${count} ${count === 1 ? 'ativo' : 'ativos'}` : 'Filtros'}
        onPress={() => router.push('/filtros')}
        testID="filter-button"
      />
      {count > 0 ? (
        <View pointerEvents="none" style={[styles.badge, { backgroundColor: colors.accent, borderColor: colors.background }]}>
          <Text variant="caption" tone={colors.onAccent} style={styles.badgeText}>
            {count}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function GenreChips() {
  const { data: genres } = useGenres();
  const selected = useFilters((s) => s.filters.genreSlugs);
  const toggle = useFilters((s) => s.toggleGenre);
  const set = useFilters((s) => s.set);
  const { gutter } = useBreakpoint();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.chips, { paddingHorizontal: gutter }]}
      style={{ marginHorizontal: -gutter }}>
      <Chip label="Tudo" selected={selected.length === 0} onPress={() => set({ genreSlugs: [] })} />
      {(genres ?? []).map((g) => (
        <Chip key={g.slug} label={g.label} selected={selected.includes(g.slug)} onPress={() => toggle(g.slug)} />
      ))}
    </ScrollView>
  );
}

export function Header({ onPickArea }: { onPickArea: () => void }) {
  const location = useLocation((s) => s.location);
  const radiusKm = useFilters((s) => s.filters.radiusKm);
  const [text, setText] = useSearchText();
  const { gutter } = useBreakpoint();
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, { paddingHorizontal: gutter }]}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`Local: ${location.label}, raio de ${radiusKm} km. Alterar`}
        onPress={onPickArea}
        style={[styles.location, { backgroundColor: colors.surfaceAlt }]}
        testID="location-chip">
        <Icon name="pin" size={18} color="accent" />
        <Text variant="bodySm" numberOfLines={1} style={styles.locText}>
          {location.label}
        </Text>
        <Text variant="mono" tone="textMuted">
          {radiusKm} km
        </Text>
        <Icon name="chevronDown" size={16} color="textMuted" />
      </PressableScale>
      <Text variant="display" accessibilityRole="header">
        Qual a boa <Text variant="display" tone={colors.accent}>hoje?</Text>
      </Text>
      <View style={styles.searchRow}>
        <SearchBar
          style={styles.search}
          value={text}
          onChangeText={setText}
          placeholder="Evento, casa ou artista"
          label="Buscar eventos, casas ou artistas"
          testID="search-input"
        />
        <FilterButton />
      </View>
      <GenreChips />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg, paddingTop: space.md, paddingBottom: space.lg },
  location: {
    minHeight: 44,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.full,
    maxWidth: '100%',
  },
  locText: { flexShrink: 1 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  search: { flex: 1 },
  chips: { gap: space.sm },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  badgeText: { fontWeight: '700' },
});

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useGenres } from '@/data/queries';
import { dateFilterLabel, dateHeadline } from '@/domain/calendar';
import { countActiveFilters, defaultFilters } from '@/domain/filters';
import { OUTSIDE_PILOT_MESSAGE } from '@/lib/location/pilot';
import { useFilters } from '@/state/filters';
import { useLocation } from '@/state/location';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/ThemeProvider';
import { Chip, Icon, IconButton, PressableScale, SearchBar, Swap, Text, useBreakpoint } from '@/ui';
import { useHydrated } from '@/ui/useHydrated';
import { minuteNow } from './clock';

const DEBOUNCE_MS = 300;

/**
 * "Qual a boa hoje?" that follows the selected date: "amanhã?", "na sexta?", "no fim de semana?"...
 * No live region on purpose: the result count already announces a change of date.
 */
export function Headline() {
  const { colors } = useTheme();
  const range = useFilters((s) => s.filters.dateRange);
  const days = useFilters((s) => s.filters.days);
  const hydrated = useHydrated();
  // The words depend on the clock; until hydrated show the default so server and client markup agree (as ItemCard does).
  const phrase = hydrated ? dateHeadline(range, days, minuteNow()) : 'hoje';
  return (
    <Swap swapKey={phrase} testID="headline">
      <Text variant="display" accessibilityRole="header">
        Qual a boa{' '}
        <Text variant="display" tone={colors.accent}>
          {`${phrase}?`}
        </Text>
      </Text>
    </Swap>
  );
}

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

/** Opens the Quando sheet; shows the active date filter. */
function DatePill({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  const range = useFilters((s) => s.filters.dateRange);
  const days = useFilters((s) => s.filters.days);
  const label = dateFilterLabel(range, days);
  const active = range !== defaultFilters.dateRange;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Quando: ${label}. Alterar`}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.location, { backgroundColor: active ? colors.accent : colors.surfaceAlt }]}
      testID="date-chip">
      <Icon name="clock" size={18} color={active ? colors.onAccent : 'accent'} />
      <Text variant="bodySm" tone={active ? colors.onAccent : 'text'} numberOfLines={1} style={styles.locText}>
        {label}
      </Text>
      <Icon name="chevronDown" size={16} color={active ? colors.onAccent : 'textMuted'} />
    </PressableScale>
  );
}

export function Header({
  onPickArea,
  onPickDate,
  onSubmitSearch,
}: {
  onPickArea: () => void;
  onPickDate?: () => void;
  /** Search key on the keyboard: opens the full search (events, venues, artists). */
  onSubmitSearch?: (text: string) => void;
}) {
  const location = useLocation((s) => s.location);
  const outsidePilot = useLocation((s) => s.outsidePilot);
  const accuracyM = useLocation((s) => s.accuracyM);
  const source = useLocation((s) => s.source);
  const chipLabel = outsidePilot
    ? OUTSIDE_PILOT_MESSAGE
    : source === 'device' && accuracyM > 1000
      ? `${location.label} (aproximada)`
      : location.label;
  const radiusKm = useFilters((s) => s.filters.radiusKm);
  const [text, setText] = useSearchText();
  const { gutter } = useBreakpoint();
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, { paddingHorizontal: gutter }]}>
      <View style={styles.pills}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`Local: ${chipLabel}, raio de ${radiusKm} km. Alterar`}
        onPress={onPickArea}
        style={[styles.location, { backgroundColor: colors.surfaceAlt }]}
        testID="location-chip">
        <Icon name="pin" size={18} color="accent" />
        <Text variant="bodySm" numberOfLines={1} style={styles.locText}>
          {chipLabel}
        </Text>
        <Text variant="mono" tone="textMuted">
          {radiusKm} km
        </Text>
        <Icon name="chevronDown" size={16} color="textMuted" />
      </PressableScale>
      {onPickDate ? <DatePill onPress={onPickDate} /> : null}
      </View>
      <Headline />
      <View style={styles.searchRow}>
        <SearchBar
          style={styles.search}
          value={text}
          onChangeText={setText}
          placeholder="Evento, casa ou artista"
          label="Buscar eventos, casas ou artistas"
          onSubmit={onSubmitSearch ? () => onSubmitSearch(text) : undefined}
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
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
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

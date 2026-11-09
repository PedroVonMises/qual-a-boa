import type { ComponentType, ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';

import { formatEventDate, formatPriceLabel } from '@/domain/format';
import { useFavorites } from '@/state/favorites';
import { useTheme } from '@/theme/ThemeProvider';
import { hit, space } from '@/theme/tokens';
import { EmptyState, EventCard, PressableScale, Text } from '@/ui';
import type { VenuePin } from './pins';

export interface VenuePanelProps {
  pins: VenuePin[];
  now: string;
  onOpenEvent: (id: string) => void;
  onOpenVenue: (slug: string) => void;
  /** Default true. The Mapa renders the header itself (above the radius slider) and turns this off. */
  showHeader?: boolean;
  /** Scroll container; inside the MapSheet this is the sheet's scroll view so drags and scrolls cooperate. */
  scroll?: ComponentType<ScrollViewProps>;
  /** Replaces the default empty state (e.g. with a "widen the radius" action). */
  empty?: ReactNode;
}

/** "Nesta área · N eventos" header. `total` undefined while loading. */
export function VenuePanelHeader({ total }: { total?: number }) {
  return (
    <View style={styles.head}>
      <Text variant="title" accessibilityRole="header">
        Nesta área
      </Text>
      {total !== undefined ? (
        <Text variant="bodySm" tone="textMuted">
          {total} {total === 1 ? 'evento' : 'eventos'}
        </Text>
      ) : null}
    </View>
  );
}

/** "Nesta área" list: events grouped under their venue. */
export function VenuePanel({ pins, now, onOpenEvent, onOpenVenue, showHeader = true, scroll: Scroll = ScrollView, empty }: VenuePanelProps) {
  const { colors } = useTheme();
  const eventIds = useFavorites((s) => s.eventIds);
  const toggleEvent = useFavorites((s) => s.toggleEvent);
  const total = pins.reduce((n, p) => n + p.items.length, 0);
  return (
    <View style={styles.root} accessibilityLabel="Eventos nesta área">
      {showHeader ? <VenuePanelHeader total={total} /> : null}
      {pins.length === 0 ? (
        (empty ?? <EmptyState title="Nenhuma casa aberta por aqui" message="Ajuste os filtros ou busque outra área." />)
      ) : (
        <Scroll contentContainerStyle={styles.list}>
          {pins.map((pin) => (
            <View key={pin.venue.id} testID={`venue-group-${pin.venue.slug}`}>
              <PressableScale
                accessibilityRole="link"
                accessibilityLabel={`Ver casa ${pin.venue.name}`}
                onPress={() => onOpenVenue(pin.venue.slug)}
                style={[styles.venue, { borderBottomColor: colors.border }]}>
                <Text variant="bodySm" tone="accent" style={styles.bold}>
                  {pin.venue.name}
                </Text>
                <Text variant="caption" tone="textMuted">
                  {pin.venue.area}
                </Text>
              </PressableScale>
              {pin.items.map(({ event, venue, distanceKm }) => (
                <EventCard
                  key={event.id}
                  variant="row"
                  testID={`event-${event.id}`}
                  title={event.title}
                  venueName={venue.name}
                  area={venue.area}
                  distanceKm={distanceKm}
                  coverKey={event.coverKey}
                  dateLabel={formatEventDate(event.startsAt, now)}
                  priceLabel={formatPriceLabel(event.priceMin, event.priceMax, event.isFree)}

                  saved={eventIds.includes(event.id)}
                  onToggleSave={() => toggleEvent(event.id)}
                  onPress={() => onOpenEvent(event.id)}
                />
              ))}
            </View>
          ))}
        </Scroll>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: space.md },
  list: { paddingBottom: space.xxxl },
  venue: {
    minHeight: hit.min,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderBottomWidth: 1,
  },
  bold: { fontWeight: '700' },
});

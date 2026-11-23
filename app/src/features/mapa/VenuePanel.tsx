import { FlatList, StyleSheet, View } from 'react-native';

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
}

/** "Nesta área" virtualized list: events grouped under their venue for smooth 200+ venue scrolling. */
export function VenuePanel({ pins, now, onOpenEvent, onOpenVenue }: VenuePanelProps) {
  const { colors } = useTheme();
  const eventIds = useFavorites((s) => s.eventIds);
  const toggleEvent = useFavorites((s) => s.toggleEvent);
  const total = pins.reduce((n, p) => n + p.items.length, 0);
  const venueLabel = `${pins.length} ${pins.length === 1 ? 'casa' : 'casas'}`;
  const eventLabel = `${total} ${total === 1 ? 'evento' : 'eventos'}`;
  return (
    <View style={styles.root} accessibilityLabel="Eventos nesta área">
      <View style={styles.head}>
        <Text variant="title" accessibilityRole="header">
          Nesta área
        </Text>
        <Text variant="bodySm" tone="textMuted">
          {pins.length > 0 ? `${venueLabel} · ${eventLabel}` : eventLabel}
        </Text>
      </View>
      {pins.length === 0 ? (
        <EmptyState title="Nenhuma casa aberta por aqui" message="Ajuste os filtros ou busque outra área." />
      ) : (
        <FlatList
          data={pins}
          keyExtractor={(pin) => pin.venue.id}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={5}
          contentContainerStyle={styles.list}
          renderItem={({ item: pin }) => (
            <View testID={`venue-group-${pin.venue.slug}`}>
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
                  imageUrl={event.imageUrl}
                  dateLabel={formatEventDate(event.startsAt, now)}
                  priceLabel={formatPriceLabel(event.priceMin, event.priceMax, event.isFree)}
                  saved={eventIds.includes(event.id)}
                  onToggleSave={() => toggleEvent(event.id)}
                  onPress={() => onOpenEvent(event.id)}
                />
              ))}
            </View>
          )}
        />
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

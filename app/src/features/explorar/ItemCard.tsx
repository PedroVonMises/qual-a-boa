import { router } from 'expo-router';
import { memo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { formatEventDate, formatPriceLabel } from '@/domain/format';
import type { SearchItem } from '@/domain/types';
import { useFavorites } from '@/state/favorites';
import { EventCard } from '@/ui';
import { minuteNow } from './clock';

export function openEvent(id: string) {
  router.push({ pathname: '/evento/[id]', params: { id } });
}

interface Props {
  item: SearchItem;
  variant?: 'poster' | 'row';
  divider?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Maps a SearchItem to the kit EventCard; owns the save toggle and navigation. */
export const ItemCard = memo(function ItemCard({ item, variant = 'poster', divider, style }: Props) {
  const { event, venue, distanceKm } = item;
  const saved = useFavorites((s) => s.eventIds.includes(event.id));
  const toggle = useFavorites((s) => s.toggleEvent);
  return (
    <EventCard
      testID={`event-${event.id}`}
      variant={variant}
      divider={divider}
      style={style}
      title={event.title}
      venueName={venue.name}
      area={venue.area}
      distanceKm={distanceKm}
      priceLabel={formatPriceLabel(event.priceMin, event.priceMax, event.isFree)}
      dateLabel={formatEventDate(event.startsAt, minuteNow())}
      coverKey={event.coverKey}
      saved={saved}
      onPress={() => openEvent(event.id)}
      onToggleSave={() => toggle(event.id)}
    />
  );
});

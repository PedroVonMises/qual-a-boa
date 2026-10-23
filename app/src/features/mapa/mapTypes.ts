import type { GeoPoint } from '@/domain/types';
import type { VenuePin } from './pins';

export interface VenueMapProps {
  pins: VenuePin[];
  selectedId: string | null;
  onSelect: (venueId: string) => void;
  center: GeoPoint;
  /** Only set when the user granted or chose a location. */
  userLocation?: GeoPoint;
}

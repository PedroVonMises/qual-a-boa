import type { GeoPoint } from '@/domain/types';
import type { VenuePin } from './pins';

export interface VenueMapProps {
  pins: VenuePin[];
  selectedId: string | null;
  onSelect: (venueId: string) => void;
  center: GeoPoint;
  /** Only set when the user granted or chose a location. */
  userLocation?: GeoPoint;
  /** Called by the "Minha localização" button; the screen decides how to get a fix. Button hidden when absent. */
  onLocate?: () => void;
  /** Changes when the set of pins changes in a way that should refit the camera (e.g. a new search). */
  fitKey?: string;
  /** Search radius drawn as a circle around `center`; the camera frames it when it (or the center) changes. */
  radiusKm?: number;
  /** Height in px covered by the bottom sheet: camera padding, attribution and the locate button sit above it. */
  bottomInset?: number;
}

import type { VenuePin } from './pins';

export interface VenueGeoJsonFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
    id: string;
    slug: string;
    name: string;
    area: string;
    eventCount: number;
    recommended: boolean;
    rank: number;
    selected: boolean;
  };
}

export interface VenueGeoJsonCollection {
  type: 'FeatureCollection';
  features: VenueGeoJsonFeature[];
}

/** Converts venue pins into a MapLibre GL GeoJSON FeatureCollection ready for GPU clustering. */
export function pinsToGeoJson(pins: readonly VenuePin[], selectedId?: string | null): VenueGeoJsonCollection {
  return {
    type: 'FeatureCollection',
    features: pins.map((pin) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [pin.venue.lng, pin.venue.lat],
      },
      properties: {
        id: pin.venue.id,
        slug: pin.venue.slug,
        name: pin.venue.name,
        area: pin.venue.area,
        eventCount: pin.items.length,
        recommended: Boolean(pin.recommended),
        rank: pin.rank ?? 0,
        selected: pin.venue.id === selectedId,
      },
    })),
  };
}

/**
 * Caps pins rendered on the offline SVG schematic fallback so 200+ venues never produce overlapping DOM clutter.
 * Always keeps the currently selected pin visible.
 */
export function capSchematicPins(pins: readonly VenuePin[], selectedId?: string | null, maxPins = 28): VenuePin[] {
  if (pins.length <= maxPins) return [...pins];
  const top = pins.slice(0, maxPins);
  if (selectedId && !top.some((p) => p.venue.id === selectedId)) {
    const sel = pins.find((p) => p.venue.id === selectedId);
    if (sel) return [...top.slice(0, maxPins - 1), sel];
  }
  return top;
}

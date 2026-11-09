import type { GeoPoint } from '@/domain/types';

/** Mean km per degree of latitude (WGS84, good to ~0.5% everywhere). */
export const KM_PER_DEG_LAT = 110.574;
/** Km per degree of longitude at the equator; scale by cos(lat) elsewhere. */
export const KM_PER_DEG_LNG = 111.32;

export type LngLatTuple = [number, number];

/**
 * Closed ring ([lng, lat] pairs, first point repeated at the end) approximating a circle of `radiusKm` around
 * `center`. Km are converted to degrees with cos(lat) for longitude, accurate enough for a city-sized radius.
 */
export function circleRing(center: Pick<GeoPoint, 'lat' | 'lng'>, radiusKm: number, points = 64): LngLatTuple[] {
  const dLat = radiusKm / KM_PER_DEG_LAT;
  const dLng = radiusKm / (KM_PER_DEG_LNG * Math.cos((center.lat * Math.PI) / 180));
  const ring: LngLatTuple[] = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * 2 * Math.PI;
    ring.push([center.lng + dLng * Math.cos(a), center.lat + dLat * Math.sin(a)]);
  }
  ring.push([ring[0][0], ring[0][1]]);
  return ring;
}

/** GeoJSON polygon feature of the radius circle (for MapLibre sources). */
export function circleFeature(center: Pick<GeoPoint, 'lat' | 'lng'>, radiusKm: number, points = 64): GeoJSON.Feature<GeoJSON.Polygon> {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [circleRing(center, radiusKm, points)] },
  };
}

/** [west, south, east, north] box around the circle, for fitBounds. */
export function circleBounds(center: Pick<GeoPoint, 'lat' | 'lng'>, radiusKm: number): [number, number, number, number] {
  const dLat = radiusKm / KM_PER_DEG_LAT;
  const dLng = radiusKm / (KM_PER_DEG_LNG * Math.cos((center.lat * Math.PI) / 180));
  return [center.lng - dLng, center.lat - dLat, center.lng + dLng, center.lat + dLat];
}

import { DEFAULT_LOCATION, type GeoPoint } from '@/domain/types';

/** Approximate centers of the Grande Vitória areas, used for manual location. */
const CENTERS: Record<string, { lat: number; lng: number }> = {
  'Praia do Canto': { lat: -20.2976, lng: -40.2958 },
  'Jardim da Penha': { lat: -20.2788, lng: -40.2885 },
  Centro: { lat: -20.3194, lng: -40.3378 },
  Camburi: { lat: -20.2706, lng: -40.2756 },
  'Vila Velha': { lat: -20.3417, lng: -40.2925 },
  'Praia da Costa': { lat: -20.3392, lng: -40.2817 },
  'Itapuã': { lat: -20.3578, lng: -40.3058 },
  Serra: { lat: -20.1286, lng: -40.3078 },
};

/** Location for a chosen area; unknown areas fall back to the default center with the area's label. */
export function areaToLocation(area: string): GeoPoint {
  const c = CENTERS[area] ?? { lat: DEFAULT_LOCATION.lat, lng: DEFAULT_LOCATION.lng };
  return { ...c, label: area };
}
import { haversineKm } from '@/domain/geo';
import { DEFAULT_LOCATION } from '@/domain/types';

/** Pilot area radius around DEFAULT_LOCATION (Grande Vitória). */
export const PILOT_RADIUS_KM = 60;
export const FALLBACK_LABEL = 'Perto de você';
export const OUTSIDE_PILOT_MESSAGE = 'Fora da área piloto (Grande Vitória)';

export function isInPilotArea(point: { lat: number; lng: number }): boolean {
  return haversineKm(point.lat, point.lng, DEFAULT_LOCATION.lat, DEFAULT_LOCATION.lng) <= PILOT_RADIUS_KM;
}

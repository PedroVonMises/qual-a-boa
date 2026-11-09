import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { DEFAULT_LOCATION, type GeoPoint } from '@/domain/types';
import { areaToLocation } from '@/features/onboarding/areas';
import { isInPilotArea } from './pilot';
import { withTimeout } from './service';

const GEOCODE_TIMEOUT_MS = 5000;

export interface GeocodeResult {
  point: GeoPoint;
  /** true = the address itself was geocoded; false = neighbourhood center or the default point. */
  precise: boolean;
}

/**
 * Address text → coordinates, on the device (expo-location `geocodeAsync`, iOS/Android only; Android needs the
 * location grant). Web, errors, empty results or points outside the pilot fall back to the neighbourhood center
 * (`district`) or DEFAULT_LOCATION. Never throws. `label` names the returned point.
 */
export async function geocodeAddress(
  text: string,
  opts: { district?: string; label?: string } = {},
): Promise<GeocodeResult> {
  const label = (opts.label ?? text).trim() || DEFAULT_LOCATION.label;
  if (Platform.OS !== 'web' && text.trim()) {
    try {
      const res = await withTimeout(Location.geocodeAsync(text), GEOCODE_TIMEOUT_MS);
      const hit = res?.find((r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude));
      if (hit) {
        const point = { lat: hit.latitude, lng: hit.longitude, label };
        if (isInPilotArea(point)) return { point, precise: true };
      }
    } catch {
      // fall through to the neighbourhood center
    }
  }
  const district = opts.district?.trim();
  const center = district ? areaToLocation(district) : DEFAULT_LOCATION;
  return { point: { lat: center.lat, lng: center.lng, label }, precise: false };
}

// Check-in por proximidade (B5). Mirror of public.check_in() in supabase/migrations/0018_checkin_proximity.sql:
// the device must be within CHECKIN_RADIUS_M of the venue, minus the fix accuracy (capped at CHECKIN_MAX_SLACK_M).

import { haversineKm } from './geo';

export const CHECKIN_RADIUS_M = 300;
export const CHECKIN_MAX_SLACK_M = 150;
/** A fix older than this is not trusted for a check-in (the person may have left). */
export const CHECKIN_MAX_FIX_AGE_MS = 5 * 60_000;

export interface CheckinPosition {
  lat: number;
  lng: number;
  /** Meters; null when the platform does not report it. */
  accuracyM: number | null;
}

export type ProximityResult = { ok: true; distanceM: number } | { ok: false; reason: 'too_far'; distanceM: number };

/** Effective distance (meters) from the venue after the accuracy allowance. */
export function effectiveDistanceM(pos: CheckinPosition, venue: { lat: number; lng: number }): number {
  const raw = haversineKm(pos.lat, pos.lng, venue.lat, venue.lng) * 1000;
  const slack = Math.min(Math.max(pos.accuracyM ?? 0, 0), CHECKIN_MAX_SLACK_M);
  return Math.max(0, raw - slack);
}

export function checkProximity(pos: CheckinPosition, venue: { lat: number; lng: number }): ProximityResult {
  const distanceM = effectiveDistanceM(pos, venue);
  return distanceM <= CHECKIN_RADIUS_M ? { ok: true, distanceM } : { ok: false, reason: 'too_far', distanceM };
}

/** "a 1,2 km" / "a 450 m", for the too-far message. */
export function formatDistanceM(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
  return `${Math.round(m / 10) * 10} m`;
}

import { CHECKIN_RADIUS_M, checkProximity, effectiveDistanceM, formatDistanceM } from './checkin';

const venue = { lat: -20.2968, lng: -40.2949 };
// ~111 m per 0.001° of latitude.
const north = (m: number, accuracyM: number | null = 10) => ({ lat: venue.lat + m / 111_195, lng: venue.lng, accuracyM });

describe('checkProximity (mirror of public.check_in)', () => {
  it('accepts at the door and up to the radius', () => {
    expect(checkProximity(north(0), venue).ok).toBe(true);
    expect(checkProximity(north(CHECKIN_RADIUS_M, 0), venue).ok).toBe(true);
  });

  it('rejects ~400 m with a precise fix, accepts it with 150 m of accuracy', () => {
    expect(checkProximity(north(400, 10), venue)).toMatchObject({ ok: false, reason: 'too_far' });
    expect(checkProximity(north(400, 150), venue).ok).toBe(true);
  });

  it('caps the accuracy allowance at 150 m', () => {
    expect(checkProximity(north(1100, 2000), venue).ok).toBe(false);
    expect(Math.round(effectiveDistanceM(north(1000, 5000), venue))).toBe(850);
    expect(effectiveDistanceM(north(1000, null), venue)).toBeCloseTo(1000, -1);
  });

  it('formats distances', () => {
    expect(formatDistanceM(447)).toBe('450 m');
    expect(formatDistanceM(1234)).toBe('1,2 km');
  });
});

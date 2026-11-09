import { circleBounds, circleFeature, circleRing, KM_PER_DEG_LAT, KM_PER_DEG_LNG } from '../radiusCircle';
import { schematicCirclePath } from '../VenueMapSchematic';

const center = { lat: -20.3, lng: -40.3 };

describe('radius circle', () => {
  it('makes a closed 64-point ring', () => {
    const ring = circleRing(center, 3);
    expect(ring).toHaveLength(65);
    expect(ring[64]).toEqual(ring[0]);
  });

  it('keeps every point at the radius (km→degrees with cos(lat))', () => {
    const cos = Math.cos((center.lat * Math.PI) / 180);
    for (const [lng, lat] of circleRing(center, 5)) {
      const dx = (lng - center.lng) * KM_PER_DEG_LNG * cos;
      const dy = (lat - center.lat) * KM_PER_DEG_LAT;
      expect(Math.hypot(dx, dy)).toBeCloseTo(5, 6);
    }
    // East point first: wider in degrees than the north offset because of cos(lat).
    const [first] = circleRing(center, 5);
    expect(first[0] - center.lng).toBeGreaterThan(5 / KM_PER_DEG_LAT);
  });

  it('builds a GeoJSON polygon and matching bounds', () => {
    const f = circleFeature(center, 10, 16);
    expect(f.geometry.type).toBe('Polygon');
    expect(f.geometry.coordinates[0]).toHaveLength(17);
    const [w, s, e, n] = circleBounds(center, 10);
    for (const [lng, lat] of f.geometry.coordinates[0]) {
      expect(lng).toBeGreaterThanOrEqual(w - 1e-9);
      expect(lng).toBeLessThanOrEqual(e + 1e-9);
      expect(lat).toBeGreaterThanOrEqual(s - 1e-9);
      expect(lat).toBeLessThanOrEqual(n + 1e-9);
    }
    expect(n - center.lat).toBeCloseTo(10 / KM_PER_DEG_LAT, 9);
  });

  it('draws the schematic outline as a closed SVG path', () => {
    const d = schematicCirclePath(center, 3);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('z')).toBe(true);
    expect(d.split('L')).toHaveLength(65);
  });
});

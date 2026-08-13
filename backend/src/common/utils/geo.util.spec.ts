import { haversineDistanceMeters, isWithinRadius } from './geo.util';

describe('geo.util', () => {
  it('returns ~0 for the same coordinate', () => {
    const point = { latitude: 11.5479313, longitude: 104.9405941 };
    expect(haversineDistanceMeters(point, point)).toBeCloseTo(0, 3);
  });

  it('matches a known distance for a small offset', () => {
    // ~0.0009 deg latitude ≈ 100m north.
    const center = { latitude: 11.5479313, longitude: 104.9405941 };
    const north = { latitude: 11.5488313, longitude: 104.9405941 };

    const distance = haversineDistanceMeters(center, north);

    expect(distance).toBeGreaterThan(90);
    expect(distance).toBeLessThan(110);
  });

  it('reports within radius when the point is inside the geofence', () => {
    const center = { latitude: 11.5479313, longitude: 104.9405941 };
    const nearby = { latitude: 11.5479813, longitude: 104.9406441 };

    expect(isWithinRadius(nearby, center, 80)).toBe(true);
  });

  it('reports outside radius when the point is far from the geofence', () => {
    const center = { latitude: 11.5479313, longitude: 104.9405941 };
    const farAway = { latitude: 11.6, longitude: 105.0 };

    expect(isWithinRadius(farAway, center, 80)).toBe(false);
  });
});

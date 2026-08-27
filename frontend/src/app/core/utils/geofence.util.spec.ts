import { describe, expect, it } from 'vitest';
import {
  describeZoneCheck,
  formatZonePreview,
  isInsideZone,
  sessionToZone,
  zoneDistanceMeters,
} from './geofence.util';

const kit = {
  latitude: 11.5479313,
  longitude: 104.9405941,
  radiusMeters: 200,
};

describe('geofence.util', () => {
  it('treats a point next to the KIT pin as inside the 200 m zone', () => {
    const here = { latitude: 11.54795, longitude: 104.94061 };
    expect(isInsideZone(here, kit)).toBe(true);
    expect(zoneDistanceMeters(here, kit)).toBeLessThanOrEqual(200);
  });

  it('treats a Galileo Street campus scan ~131 m south as inside', () => {
    const galileo = { latitude: 11.546736, longitude: 104.940616 };
    const check = describeZoneCheck(galileo, kit);
    expect(check.inside).toBe(true);
    expect(check.distanceMeters).toBeGreaterThan(100);
    expect(check.distanceMeters).toBeLessThanOrEqual(200);
  });

  it('treats a point 2.9 km away as outside', () => {
    const home = { latitude: 11.527966, longitude: 104.92299 };
    const check = describeZoneCheck(home, kit);
    expect(check.inside).toBe(false);
    expect(check.distanceMeters).toBeGreaterThan(2800);
    expect(formatZonePreview(check)).toMatch(/^Outside zone · 2\.\d km$/);
  });

  it('formats a nearby inside reading in meters', () => {
    expect(
      formatZonePreview({ inside: true, distanceMeters: 24 }),
    ).toBe('Inside zone · 24 m');
  });

  it('builds a zone from an open session payload', () => {
    expect(
      sessionToZone({
        latitude: kit.latitude,
        longitude: kit.longitude,
        radiusMeters: 200,
      }),
    ).toEqual(kit);
    expect(sessionToZone({ latitude: 1, longitude: 2 })).toBeNull();
  });
});

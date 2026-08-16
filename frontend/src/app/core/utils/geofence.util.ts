import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import circle from '@turf/circle';
import distance from '@turf/distance';
import { point } from '@turf/helpers';

/** WGS84 point from the device or a campus zone. */
export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/** Session geofence: pin + radius in meters. */
export interface GeoZone extends GeoPoint {
  radiusMeters: number;
}

export interface ZoneCheck {
  inside: boolean;
  distanceMeters: number;
}

/** Great-circle distance in meters (Turf / Haversine). */
export function zoneDistanceMeters(from: GeoPoint, zone: GeoPoint): number {
  return distance(
    point([from.longitude, from.latitude]),
    point([zone.longitude, zone.latitude]),
    { units: 'meters' },
  );
}

/** True when the point falls inside the zone circle (Turf polygon). */
export function isInsideZone(from: GeoPoint, zone: GeoZone): boolean {
  const polygon = circle(
    point([zone.longitude, zone.latitude]),
    zone.radiusMeters,
    { units: 'meters', steps: 64 },
  );
  return booleanPointInPolygon(
    point([from.longitude, from.latitude]),
    polygon,
  );
}

/** Preview used on the student scan card before the server decides status. */
export function describeZoneCheck(from: GeoPoint, zone: GeoZone): ZoneCheck {
  const distanceMeters = Math.round(zoneDistanceMeters(from, zone));
  return {
    inside: isInsideZone(from, zone),
    distanceMeters,
  };
}

export function formatZonePreview(check: ZoneCheck): string {
  const { inside, distanceMeters } = check;
  const range =
    distanceMeters >= 1000
      ? `${(distanceMeters / 1000).toFixed(1)} km`
      : `${distanceMeters} m`;
  return inside ? `Inside zone · ${range}` : `Outside zone · ${range}`;
}

export function sessionToZone(session: {
  latitude?: number | null;
  longitude?: number | null;
  radiusMeters?: number | null;
}): GeoZone | null {
  if (
    session.latitude == null ||
    session.longitude == null ||
    session.radiusMeters == null
  ) {
    return null;
  }
  return {
    latitude: session.latitude,
    longitude: session.longitude,
    radiusMeters: session.radiusMeters,
  };
}

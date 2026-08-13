/** A raw latitude/longitude pair (WGS84 degrees). */
export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_METERS = 6_371_000;

/**
 * Great-circle distance between two coordinates via the Haversine formula.
 * Accurate to well under a meter at campus scale — enough to check a student's
 * device position against a location's `radiusMeters` geofence.
 */
export function haversineDistanceMeters(
  from: GeoCoordinates,
  to: GeoCoordinates,
): number {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/** True when `point` falls within `radiusMeters` of `center`. */
export function isWithinRadius(
  point: GeoCoordinates,
  center: GeoCoordinates,
  radiusMeters: number,
): boolean {
  return haversineDistanceMeters(point, center) <= radiusMeters;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

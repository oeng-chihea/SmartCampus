import { CampusLocationResponseDto } from '../dto/location-response.dto';

/**
 * Seeded campus zones for geofence-backed attendance sessions.
 * The teacher session picker exposes exactly the three KIT buildings.
 *
 * Default pin (LOC-001) is KIT Phnom Penh Campus from
 * https://maps.app.goo.gl/fWTmb9wFLkMZQRp29
 * (11.5479313, 104.9405941). Radius is 200 m so Galileo Street /
 * Elite Town III scans (~130 m south of the Maps pin) still count as
 * inside. Building B and C keep their existing campus offsets and radii.
 * The seeder writes these into MySQL on boot; keep `locations.json` in sync.
 *
 * sessionsUsing starts at 0 and is updated by SessionsService.
 */
export const DEFAULT_LOCATION_ID = 'LOC-001';

export const DEFAULT_CAMPUS_COORDINATES = {
  latitude: 11.5479313,
  longitude: 104.9405941,
} as const;

/** Default KIT zone radius. Covers the Koh Pich campus compound. */
export const DEFAULT_LOCATION_RADIUS_METERS = 200;

export const LOCATION_SEED: CampusLocationResponseDto[] = [
  {
    id: DEFAULT_LOCATION_ID,
    name: 'KIT-Building A',
    building: 'KIT-Building A',
    room: '',
    radiusMeters: DEFAULT_LOCATION_RADIUS_METERS,
    latitude: DEFAULT_CAMPUS_COORDINATES.latitude,
    longitude: DEFAULT_CAMPUS_COORDINATES.longitude,
    status: 'Active',
    sessionsUsing: 0,
  },
  {
    id: 'LOC-002',
    name: 'KIT-Building B',
    building: 'KIT-Building B',
    room: '',
    radiusMeters: 60,
    latitude: 11.5486313,
    longitude: 104.9413941,
    status: 'Active',
    sessionsUsing: 0,
  },
  {
    id: 'LOC-003',
    name: 'KIT-Building C',
    building: 'KIT-Building C',
    room: '',
    radiusMeters: 100,
    latitude: 11.5473313,
    longitude: 104.9398941,
    status: 'Active',
    sessionsUsing: 0,
  },
];

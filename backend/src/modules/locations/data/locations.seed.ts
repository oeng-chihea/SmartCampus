import { CampusLocationResponseDto } from '../dto/location-response.dto';

/**
 * Seeded campus zones for geofence-backed attendance sessions.
 * Buildings stay A / B / C for the teacher session picker.
 *
 * Default pin (LOC-001) is KIT Phnom Penh Campus from
 * https://maps.app.goo.gl/fWTmb9wFLkMZQRp29
 * (11.5479313, 104.9405941). Other rooms are small offsets on the
 * same campus so each zone has its own radius. The seeder writes these
 * into MySQL on boot; keep `locations.json` in sync.
 *
 * sessionsUsing starts at 0 and is updated by SessionsService.
 */
export const DEFAULT_LOCATION_ID = 'LOC-001';

export const DEFAULT_CAMPUS_COORDINATES = {
  latitude: 11.5479313,
  longitude: 104.9405941,
} as const;

export const LOCATION_SEED: CampusLocationResponseDto[] = [
  {
    id: DEFAULT_LOCATION_ID,
    name: 'Building A, Room 201',
    building: 'Building A',
    room: '201',
    radiusMeters: 80,
    latitude: DEFAULT_CAMPUS_COORDINATES.latitude,
    longitude: DEFAULT_CAMPUS_COORDINATES.longitude,
    status: 'Active',
    sessionsUsing: 0,
  },
  {
    id: 'LOC-002',
    name: 'Building B, Room 105',
    building: 'Building B',
    room: '105',
    radiusMeters: 60,
    latitude: 11.5486313,
    longitude: 104.9413941,
    status: 'Active',
    sessionsUsing: 0,
  },
  {
    id: 'LOC-003',
    name: 'Building C, Room 101',
    building: 'Building C',
    room: '101',
    radiusMeters: 100,
    latitude: 11.5473313,
    longitude: 104.9398941,
    status: 'Active',
    sessionsUsing: 0,
  },
  {
    id: 'LOC-004',
    name: 'Building A, Hall 1',
    building: 'Building A',
    room: 'Hall 1',
    radiusMeters: 120,
    latitude: 11.5481313,
    longitude: 104.9408941,
    status: 'Active',
    sessionsUsing: 0,
  },
  {
    id: 'LOC-005',
    name: 'Building B, Open Studio',
    building: 'Building B',
    room: 'Studio',
    radiusMeters: 90,
    latitude: 11.5488313,
    longitude: 104.9417941,
    status: 'Inactive',
    sessionsUsing: 0,
  },
  {
    id: 'LOC-006',
    name: 'Building C, Lab 2',
    building: 'Building C',
    room: 'Lab 2',
    radiusMeters: 75,
    latitude: 11.5470313,
    longitude: 104.9395941,
    status: 'Active',
    sessionsUsing: 0,
  },
  {
    id: 'LOC-007',
    name: 'Building A, Quiet Zone',
    building: 'Building A',
    room: 'QZ',
    radiusMeters: 40,
    latitude: 11.5497313,
    longitude: 104.9388941,
    status: 'Inactive',
    sessionsUsing: 0,
  },
  {
    id: 'LOC-008',
    name: 'Building B, Room 210',
    building: 'Building B',
    room: '210',
    radiusMeters: 50,
    latitude: 11.5495313,
    longitude: 104.9391941,
    status: 'Active',
    sessionsUsing: 0,
  },
];

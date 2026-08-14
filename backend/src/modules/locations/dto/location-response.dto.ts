export type LocationStatus = 'Active' | 'Inactive';

export interface CampusLocationResponseDto {
  id: string;
  name: string;
  building: string;
  room: string;
  radiusMeters: number;
  latitude: number;
  longitude: number;
  status: LocationStatus;
  sessionsUsing: number;
}

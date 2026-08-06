import { AttendanceStatus } from '../../../common/constants/status.constant';

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

export interface LocationPersonPresenceResponseDto {
  name: string;
  studentId: string;
  email: string | null;
  course: string | null;
  year: string | null;
  session: string;
  status: AttendanceStatus;
  submittedAt: string;
  distanceMeters: number | null;
  locationArea: string;
}

export interface LocationDetailResponseDto {
  location: CampusLocationResponseDto;
  people: LocationPersonPresenceResponseDto[];
}

import { AttendanceStatus } from '../../../common/constants/status.constant';

/** One student scan / mark-present at a campus zone. */
export interface LocationVisitResponseDto {
  id: string;
  student: string;
  studentId: string;
  locationId: string;
  locationName: string;
  building: string;
  room: string;
  session: string;
  sessionId: string;
  status: AttendanceStatus;
  recordedAt: string;
  distanceMeters: number | null;
  /** Student device GPS at scan / mark-present. Null on older rows. */
  latitude: number | null;
  longitude: number | null;
  /** Reverse-geocoded place name of the student's scan point. */
  scannedLocation: string | null;
  /** Browser-reported GPS accuracy in meters. Null on older rows. */
  accuracyMeters: number | null;
}

export interface LocationVisitMetricsDto {
  total: number;
  present: number;
  outsideLocation: number;
}

export interface LocationVisitPageResponseDto {
  visits: LocationVisitResponseDto[];
  metrics: LocationVisitMetricsDto;
  buildingOptions: string[];
  statusOptions: AttendanceStatus[];
}

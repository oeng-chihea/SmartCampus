import { AttendanceStatus } from '../../../common/constants/status.constant';

export interface AttendanceRecordResponseDto {
  id: string;
  student: string;
  studentId: string;
  sessionId: string;
  session: string;
  location: string;
  recordedAt: string;
  submittedAt: string;
  status: AttendanceStatus;
  /**
   * Distance (meters) from the session's location at submit time.
   * Always set — submit is rejected outright when the client has no GPS fix
   * (FR-02 hard location gate), so a saved record never has an unknown distance.
   */
  distanceMeters: number | null;
  /** Device GPS at submit time. Null only on rows saved before GPS was stored. */
  latitude: number | null;
  longitude: number | null;
  /** Reverse-geocoded place name of the device GPS. Null if lookup failed. */
  scannedLocation: string | null;
  /** Browser-reported GPS accuracy in meters. Null on older rows. */
  accuracyMeters: number | null;
}

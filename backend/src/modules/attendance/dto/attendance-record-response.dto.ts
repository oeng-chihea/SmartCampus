import {
  AttendanceLocationStatus,
  AttendanceCheckInStatus,
} from '../../../common/constants/status.constant';

export interface AttendanceRecordResponseDto {
  id: string;
  student: string;
  studentId: string;
  sessionId: string;
  session: string;
  location: string;
  recordedAt: string;
  submittedAt: string;
  /** Geofence result: Inside / Outside Location. Null when absent. */
  status: AttendanceLocationStatus | null;
  /**
   * Present = student scanned / marked present (including Outside Location).
   * Absent = no scan by the session due time.
   */
  attendanceStatus: AttendanceCheckInStatus;
  /**
   * Distance (meters) from the session's location at submit time.
   * Null on Absent rows (no GPS). Scan rows always have a distance because
   * submit is rejected without coordinates (FR-02 hard location gate).
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

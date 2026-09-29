import { SelectOption } from '../shared/components/select-dropdown/select-dropdown.model';

/** Geofence result stored on an attendance record. */
export type AttendanceLocationStatus = 'Inside' | 'Outside Location';

/** Attendance check-in result stored independently from the geofence result. */
export type AttendanceCheckInStatus = 'Present' | 'Absent';

/** Geofence filter values sent as `status` on POST /attendance/admin. */
export type AttendanceLocationFilter = 'inside' | 'outside';

export interface AttendanceRecord {
  id: string;
  student: string;
  studentId: string;
  /** Owning live session id — used to match cards, not the display title. */
  sessionId: string;
  session: string;
  location: string;
  recordedAt: string;
  submittedAt: string;
  /** Inside / Outside Location. Null when the student did not check in. */
  status: AttendanceLocationStatus | null;
  /** Present = scanned; Absent = no scan by the session due time. */
  attendanceStatus: AttendanceCheckInStatus;
  distanceMeters: number | null;
  /** Device GPS at submit time. Null on rows saved before GPS was stored. */
  latitude: number | null;
  longitude: number | null;
  /** Reverse-geocoded place name of the device GPS. */
  scannedLocation: string | null;
  /** Browser-reported GPS accuracy in meters. Null on older rows. */
  accuracyMeters: number | null;
}

/**
 * Student manual check-in — full temporary attendance payload from the live session, plus an
 * optional device GPS fix used for the geofence check (FR-02). Coordinates
 * are omitted when the browser denies/lacks geolocation.
 */
export interface SubmitAttendanceRequest {
  payload: string;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
}

/** Preview after attendance payload validation — does not create a record. */
export interface AttendancePreview {
  sessionId: string;
  title: string;
  locationName: string;
  dueAt: string | null;
  alreadySubmitted: boolean;
}

/** Student scan page step machine. */
export type StudentScanStep = 'scan' | 'preview' | 'result';

/** Counts returned by the backend for the summary cards (FR-06). */
export interface AttendanceMetrics {
  present: number;
  /** @deprecated Attendance status now has only Present and Absent. */
  late: number;
  absent: number;
  outsideLocation: number;
}

/** Real response of POST /attendance/admin — records + summary + status list. */
export interface AdminAttendanceResponse {
  records: AttendanceRecord[];
  metrics: AttendanceMetrics;
  statusOptions: AttendanceLocationStatus[];
  attendanceStatusOptions: AttendanceCheckInStatus[];
}

/**
 * POST /attendance/admin request body.
 * Mirrors the backend `AdminAttendanceFilterDto` field-for-field
 * (`search?`, `sessionId?`, `status?`, `attendanceStatus?`, `date?`) —
 * omitted fields = no filter.
 */
export interface AdminAttendanceFilterRequest {
  search?: string;
  sessionId?: string;
  status?: AttendanceLocationFilter;
  attendanceStatus?: AttendanceCheckInStatus;
  date?: 'today' | 'yesterday' | 'week';
}

/**
 * Filter state the shared toolbar emits; `all` means no restriction.
 * Converted to `AdminAttendanceFilterRequest` before it hits the API.
 */
export interface AttendanceFilterState {
  search: string;
  sessionId: string;
  status: string;
  attendanceStatus: string;
  date: string;
}

/** UI-only option lists the toolbar renders — never sent to the backend. */
export interface AttendanceFilterOptions {
  searchPlaceholder: string;
  statusOptions: SelectOption[];
  attendanceStatusOptions: SelectOption[];
  dateOptions: SelectOption[];
}

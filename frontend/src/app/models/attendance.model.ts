import { SelectOption } from '../shared/components/select-dropdown/select-dropdown.model';

/** FR-06 attendance statuses */
export type AttendanceStatus = 'Present' | 'Late' | 'Absent' | 'Outside Location';

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
  status: AttendanceStatus;
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
 * Student scan submit — full QR payload from the teacher screen, plus an
 * optional device GPS fix used for the geofence check (FR-02). Coordinates
 * are omitted when the browser denies/lacks geolocation.
 */
export interface SubmitAttendanceRequest {
  payload: string;
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
}

/** Preview after QR decode — does not create a record. */
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
  late: number;
  absent: number;
}

/** Real response of POST /attendance/admin — records + summary + status list. */
export interface AdminAttendanceResponse {
  records: AttendanceRecord[];
  metrics: AttendanceMetrics;
  statusOptions: AttendanceStatus[];
}

/**
 * POST /attendance/admin request body.
 * Mirrors the backend `AdminAttendanceFilterDto` field-for-field
 * (`search?`, `sessionId?`, `status?`, `date?`) — omitted fields = no filter.
 */
export interface AdminAttendanceFilterRequest {
  search?: string;
  sessionId?: string;
  status?: AttendanceStatus;
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
  date: string;
}

/** UI-only option lists the toolbar renders — never sent to the backend. */
export interface AttendanceFilterOptions {
  searchPlaceholder: string;
  statusOptions: SelectOption[];
  dateOptions: SelectOption[];
}

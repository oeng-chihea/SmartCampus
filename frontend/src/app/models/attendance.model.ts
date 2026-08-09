import { SelectOption } from '../shared/components/select-dropdown/select-dropdown.model';

/** FR-06 attendance statuses */
export type AttendanceStatus = 'Present' | 'Late' | 'Absent' | 'Outside Location';

export interface AttendanceRecord {
  id: string;
  student: string;
  studentId: string;
  session: string;
  location: string;
  recordedAt: string;
  submittedAt: string;
  status: AttendanceStatus;
  distanceMeters: number | null;
}

/** Student scan submit — full QR payload from the teacher screen. */
export interface SubmitAttendanceRequest {
  payload: string;
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
  sessionOptions: SelectOption[];
  statusOptions: SelectOption[];
  dateOptions: SelectOption[];
}

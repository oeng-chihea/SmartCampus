import { StatCard } from '../shared/components/stat-card/stat-card.model';

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

export interface AttendanceFilters {
  searchPlaceholder: string;
  sessionOptions: string[];
  statusOptions: Array<'All statuses' | AttendanceStatus>;
  dateOptions: string[];
}

export interface AttendanceFilterState {
  search: string;
  session: string;
  status: string;
  date: string;
}

export interface AdminAttendancePage {
  title: string;
  subtitle: string;
  metrics: StatCard[];
  filters: AttendanceFilters;
  records: AttendanceRecord[];
}

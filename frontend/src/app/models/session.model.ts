import { CampusLocation } from './location.model';

/** Attendance session lifecycle from the Nest sessions API. */
export type SessionStatus = 'Open' | 'Closed';

export interface SessionQrSnapshot {
  token: string;
  issuedAt: string;
  expiresAt: string;
}

export interface AttendanceSession {
  id: string;
  title: string;
  locationId: string;
  locationName: string;
  teacherId: string;
  teacherName: string;
  status: SessionStatus;
  /** When student mark-present stops being accepted (ISO). Null on legacy rows. */
  dueAt: string | null;
  createdAt: string;
  openedAt: string;
  closedAt: string | null;
  currentQr?: SessionQrSnapshot | null;
}

export interface CreateSessionRequest {
  title: string;
  locationId: string;
  /** Absolute due instant (ISO) built from local today + time input. */
  dueAt: string;
}

export interface SessionQrResponse {
  sessionId: string;
  token: string;
  issuedAt: string;
  expiresAt: string;
  ttlSeconds: number;
  /** Encode this string into a QR image for students to scan. */
  payload: string;
}

/** Open session shared live with students (same QR as teacher). */
export interface OpenLiveSession {
  id: string;
  title: string;
  locationName: string;
  teacherName: string;
  dueAt: string | null;
  openedAt: string;
  qr: SessionQrResponse;
}

/** Open session card ready for the student UI (includes rendered QR image). */
export interface OpenLiveSessionCard extends OpenLiveSession {
  qrDataUrl: string;
}

/** Writable form fields for the create-session dialog. */
export interface SessionsFormState {
  title: string;
  locationId: string;
  /** HTML time input value `HH:mm` (local). */
  dueTime: string;
}

/** Snapshot of reactive sessions page data (state / docs). */
export interface SessionsDataState {
  locations: CampusLocation[];
  sessions: AttendanceSession[];
  selectedSessionId: string | null;
  qr: SessionQrResponse | null;
  qrDataUrl: string | null;
}

/** Sessions page UI flags and banners. */
export interface SessionsUiState {
  loading: boolean;
  creating: boolean;
  closingId: string | null;
  qrLoading: boolean;
  createDialogOpen: boolean;
  error: string | null;
  success: string | null;
  dialogError: string | null;
}

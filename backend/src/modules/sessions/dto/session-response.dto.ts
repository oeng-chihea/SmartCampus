import { SessionStatus } from '../../../common/constants/session.constant';

export interface SessionQrSnapshot {
  token: string;
  issuedAt: string;
  expiresAt: string;
}

export interface SessionResponseDto {
  id: string;
  title: string;
  locationId: string;
  locationName: string;
  teacherId: string;
  teacherName: string;
  status: SessionStatus;
  /** When student attendance stops being accepted (ISO). Null for legacy rows. */
  dueAt: string | null;
  createdAt: string;
  openedAt: string;
  closedAt: string | null;
  /** Present only for the session owner or admin when the session is Open. */
  currentQr?: SessionQrSnapshot | null;
}

export interface QrResponseDto {
  sessionId: string;
  token: string;
  issuedAt: string;
  expiresAt: string;
  ttlSeconds: number;
  /** Encode this string into a QR image on the frontend. */
  payload: string;
}

/**
 * Minimal session snapshot for student scan validation.
 * Attendance uses this; it does not expose QR tokens.
 */
export interface SessionScanContext {
  id: string;
  title: string;
  locationName: string;
  openedAt: Date;
  dueAt: Date | null;
}

/**
 * Open class sessions shared live with students (same QR as teacher).
 */
export interface OpenSessionLiveDto {
  id: string;
  title: string;
  locationName: string;
  teacherName: string;
  dueAt: string | null;
  openedAt: string;
  /** Live short-lived QR — same payload teacher shows. */
  qr: QrResponseDto;
}

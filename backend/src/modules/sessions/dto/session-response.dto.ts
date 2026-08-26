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
  /** Present only for the session owner when the session is Open. */
  currentQr?: SessionQrSnapshot | null;
}

/** Pagination envelope for GET /sessions?page=&limit= (session picker). */
export interface SessionsPageMetaDto {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedSessionsResponseDto {
  items: SessionResponseDto[];
  pagination: SessionsPageMetaDto;
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
  locationId: string;
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
  locationId: string;
  locationName: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  teacherName: string;
  dueAt: string | null;
  openedAt: string;
  /** Live short-lived QR — same payload teacher shows. */
  qr: QrResponseDto;
}

/** Attendance session lifecycle and short-lived QR defaults. */

export const SESSION_STATUS = {
  open: 'Open',
  closed: 'Closed',
} as const;

export type SessionStatus =
  (typeof SESSION_STATUS)[keyof typeof SESSION_STATUS];

/**
 * How long a QR token remains valid before the server rotates it.
 * Long enough for the phone flow: scan with Camera app → (login) → submit.
 */
export const QR_TTL_SECONDS = 300;

/** Default minutes after session open when scans become Late. */
export const DEFAULT_LATE_AFTER_MINUTES = 15;

/** Prefix encoded into the QR payload for student scanners. */
export const QR_PAYLOAD_PREFIX = 'SMARTCAMPUS';

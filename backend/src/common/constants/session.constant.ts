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

/**
 * Minimum lead time when creating a session due time (minutes ahead of now).
 * Teachers must set attendance open-until slightly in the future.
 */
export const MIN_DUE_AHEAD_MINUTES = 1;

/** Prefix encoded into the QR payload for student scanners. */
export const QR_PAYLOAD_PREFIX = 'SMARTCAMPUS';

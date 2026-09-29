/**
 * Attendance QR helpers.
 *
 * Backend still validates the raw token string:
 *   SMARTCAMPUS|<sessionId>|<token>
 *
 * Teacher and student QR images encode the raw temporary attendance payload.
 * Existing scanned text can still be normalized from a legacy deep-link URL.
 */

export const QR_PAYLOAD_PREFIX = 'SMARTCAMPUS';

/** Public site origin for teacher QR. Prefers a configured URL over this tab. */
export function resolveAppOrigin(
  appBaseUrl: string,
  windowOrigin: string,
): string {
  const configured = String(appBaseUrl ?? '')
    .trim()
    .replace(/\/$/, '');
  if (configured) {
    return configured;
  }
  return String(windowOrigin ?? '')
    .trim()
    .replace(/\/$/, '');
}

/**
 * Extract a backend-ready payload from either:
 * - raw text: SMARTCAMPUS|sessionId|token
 * - deep-link URL: .../student/scan?payload=SMARTCAMPUS%7C...
 */
export function extractAttendancePayload(scanned: string): string | null {
  const text = scanned.trim();
  if (!text) {
    return null;
  }

  if (isRawAttendancePayload(text)) {
    return text;
  }

  try {
    const url = new URL(text);
    const fromQuery = url.searchParams.get('payload');
    if (fromQuery && isRawAttendancePayload(fromQuery)) {
      return fromQuery;
    }
  } catch {
    // Not an absolute URL — try relative / query-only forms.
  }

  if (text.includes('payload=')) {
    try {
      const url = new URL(text, 'http://local.invalid');
      const fromQuery = url.searchParams.get('payload');
      if (fromQuery && isRawAttendancePayload(fromQuery)) {
        return fromQuery;
      }
    } catch {
      // ignore
    }
  }

  return null;
}

/** True when text looks like the live session QR payload. */
export function isRawAttendancePayload(value: string): boolean {
  const parts = value.split('|');
  return (
    parts.length === 3 &&
    parts[0] === QR_PAYLOAD_PREFIX &&
    parts[1].length > 0 &&
    parts[2].length > 0
  );
}

/** Session id segment from a valid raw payload, if any. */
export function sessionIdFromPayload(payload: string): string | null {
  if (!isRawAttendancePayload(payload)) {
    return null;
  }
  return payload.split('|')[1] ?? null;
}

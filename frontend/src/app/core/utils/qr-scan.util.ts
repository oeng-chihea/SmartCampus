/**
 * Attendance QR helpers.
 *
 * Backend still validates the raw token string:
 *   SMARTCAMPUS|<sessionId>|<token>
 *
 * Teacher QR images encode a deep link so the iPhone Camera app can open Safari:
 *   https://host/student/scan?payload=SMARTCAMPUS%7C...
 */

import { environment } from '../../../environments/environment';

export const QR_PAYLOAD_PREFIX = 'SMARTCAMPUS';

/** Build the student deep-link URL encoded into teacher QR images. */
export function buildAttendanceScanUrl(
  rawPayload: string,
  origin: string =
    environment.appBaseUrl || (typeof window !== 'undefined' ? window.location.origin : ''),
): string {
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : '');
  if (!base) {
    throw new Error('No app origin configured (set environment.appBaseUrl).');
  }
  const url = new URL(`${base.replace(/\/$/, '')}/student/scan`);
  url.searchParams.set('payload', rawPayload);
  return url.toString();
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

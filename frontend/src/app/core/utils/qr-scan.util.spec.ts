import { describe, expect, it } from 'vitest';
import {
  extractAttendancePayload,
  isRawAttendancePayload,
  resolveAppOrigin,
  sessionIdFromPayload,
} from './qr-scan.util';

const RAW = 'SMARTCAMPUS|SES-001|token-abc';

describe('qr-scan.util', () => {
  it('detects raw attendance payloads', () => {
    expect(isRawAttendancePayload(RAW)).toBe(true);
    expect(isRawAttendancePayload('hello')).toBe(false);
    expect(isRawAttendancePayload('SMARTCAMPUS|only-two')).toBe(false);
  });

  it('prefers a configured public URL over the current tab', () => {
    expect(
      resolveAppOrigin('https://smart-campus.onrender.com/', 'https://localhost:4200'),
    ).toBe('https://smart-campus.onrender.com');
    expect(resolveAppOrigin('', 'https://smart-campus.onrender.com')).toBe(
      'https://smart-campus.onrender.com',
    );
  });

  it('extracts payload from raw text and deep-link URLs', () => {
    expect(extractAttendancePayload(RAW)).toBe(RAW);
    expect(
      extractAttendancePayload(
        'https://campus.example/student/scan?payload=SMARTCAMPUS%7CSES-001%7Ctoken-abc',
      ),
    ).toBe(RAW);
    expect(extractAttendancePayload('https://example.com/?x=1')).toBeNull();
  });

  it('reads session id from a valid payload', () => {
    expect(sessionIdFromPayload(RAW)).toBe('SES-001');
    expect(sessionIdFromPayload('nope')).toBeNull();
  });
});

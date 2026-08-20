import { describe, expect, it } from 'vitest';
import { AttendanceRecord } from '../../../../models/attendance.model';
import { StudentScanPageState } from './student-scan.state';

function record(
  patch: Partial<AttendanceRecord> & Pick<AttendanceRecord, 'id' | 'sessionId' | 'session'>,
): AttendanceRecord {
  return {
    student: 'Kim',
    studentId: '2004',
    location: 'Building A, Room 201',
    recordedAt: '2026-08-16T00:42:00.000Z',
    submittedAt: '2026-08-16T00:42:00.000Z',
    status: 'Outside Location',
    attendanceStatus: 'Present',
    distanceMeters: 2900,
    latitude: 11.528,
    longitude: 104.923,
    scannedLocation: 'Street 430',
    accuracyMeters: 68,
    ...patch,
  };
}

describe('StudentScanPageState session matching', () => {
  it('treats two live sessions with the same title as separate records', () => {
    const state = new StudentScanPageState();
    state.setHistory([
      record({
        id: 'att-1',
        sessionId: 'ses-building-a',
        session: 'Create this for testing scan lcoation',
      }),
    ]);

    expect(state.hasSubmittedFor('ses-building-a')).toBe(true);
    expect(state.hasSubmittedFor('ses-building-b')).toBe(false);
    expect(state.recordForSession('ses-building-b')).toBeNull();
  });
});

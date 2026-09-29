import { describe, expect, it } from 'vitest';
import { AttendanceRecord } from '../../models/attendance.model';
import {
  formatAttendanceRecordVoiceDetail,
  formatAttendanceVoiceSummary,
  formatLocationVisitVoiceDetail,
  summarizeAttendanceRecords,
} from './voice-record-summary.util';

function record(
  overrides: Partial<AttendanceRecord>,
): AttendanceRecord {
  return {
    id: 'att-1',
    student: 'Chihea',
    studentId: 'SC-1001',
    sessionId: 'ses-1',
    session: 'Morning',
    location: 'Building A',
    recordedAt: '2026-08-20T02:00:00.000Z',
    submittedAt: '2026-08-20T02:00:00.000Z',
    status: 'Inside',
    attendanceStatus: 'Present',
    distanceMeters: 8,
    latitude: 11.54,
    longitude: 104.94,
    scannedLocation: 'KIT',
    accuracyMeters: 12,
    ...overrides,
  };
}

describe('voice record summary', () => {
  it('counts present, absent, inside, and outside without filtering the list', () => {
    const summary = summarizeAttendanceRecords([
      record({ id: '1', status: 'Inside', attendanceStatus: 'Present' }),
      record({
        id: '2',
        student: 'Dara',
        status: 'Outside Location',
        attendanceStatus: 'Present',
      }),
      record({
        id: '3',
        student: 'Sophea',
        status: null,
        attendanceStatus: 'Absent',
        distanceMeters: null,
        latitude: null,
        longitude: null,
        scannedLocation: null,
        accuracyMeters: null,
      }),
    ]);

    expect(summary).toEqual({
      total: 3,
      present: 2,
      absent: 1,
      inside: 1,
      outside: 1,
    });
    expect(formatAttendanceVoiceSummary(summary)).toContain('2 present');
    expect(formatAttendanceVoiceSummary(summary)).toContain('1 absent');
    expect(formatAttendanceVoiceSummary(summary)).toContain(
      '1 inside the location',
    );
  });

  it('reads student name, building, and distance on a record', () => {
    const detail = formatAttendanceRecordVoiceDetail(
      record({ location: 'Building A-Room 201', distanceMeters: 12 }),
    );
    expect(detail).toContain('Chihea');
    expect(detail).toContain('SC-1001');
    expect(detail).toContain('Building A-Room 201');
    expect(detail).toContain('12 m');
    expect(detail).toContain('scanned at KIT');
    expect(detail).toContain('Inside');
  });

  it('reads visit building, room, and distance', () => {
    const detail = formatLocationVisitVoiceDetail({
      id: 'v1',
      student: 'Chihea',
      studentId: 'SC-1001',
      locationId: 'LOC-001',
      locationName: 'Room 201',
      building: 'Building A',
      room: '201',
      session: 'Morning',
      sessionId: 'ses-1',
      status: 'Inside',
      recordedAt: '2026-08-20T02:00:00.000Z',
      distanceMeters: 12,
      latitude: 11.54,
      longitude: 104.94,
      scannedLocation: 'KIT',
      accuracyMeters: 8,
    });
    expect(detail).toContain('Chihea');
    expect(detail).toContain('Building A-Room 201');
    expect(detail).toContain('Building A');
    expect(detail).toContain('12 m');
    expect(detail).toContain('scanned at KIT');
  });
});

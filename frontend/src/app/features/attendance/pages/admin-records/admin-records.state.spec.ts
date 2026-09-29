import { describe, expect, it } from 'vitest';
import { AdminAttendanceResponse } from '../../../../models/attendance.model';
import { AdminRecordsState } from './admin-records.state';

function samplePage(
  overrides: Partial<AdminAttendanceResponse> = {},
): AdminAttendanceResponse {
  return {
    records: [
      {
        id: 'att-1',
        student: 'Chihea',
        studentId: 'SC-1001',
        sessionId: 'sess-1',
        session: 'SE401',
        location: 'Building A, Room 201',
        recordedAt: '2026-08-20T02:00:00.000Z',
        submittedAt: '2026-08-20T02:00:00.000Z',
        status: 'Inside',
        attendanceStatus: 'Present',
        distanceMeters: 12,
        latitude: 11.54795,
        longitude: 104.94061,
        scannedLocation: 'KIT',
        accuracyMeters: 18,
      },
      {
        id: 'att-2',
        student: 'Sok Dara',
        studentId: 'SC-1024',
        sessionId: 'sess-1',
        session: 'SE401',
        location: 'Building A, Room 201',
        recordedAt: '2026-08-20T02:05:00.000Z',
        submittedAt: '2026-08-20T02:05:00.000Z',
        status: null,
        attendanceStatus: 'Absent',
        distanceMeters: null,
        latitude: null,
        longitude: null,
        scannedLocation: null,
        accuracyMeters: null,
      },
    ],
    metrics: {
      present: 1,
      late: 0,
      absent: 1,
      outsideLocation: 0,
    },
    statusOptions: ['Inside', 'Outside Location'],
    attendanceStatusOptions: ['Present', 'Absent'],
    ...overrides,
  };
}

describe('AdminRecordsState', () => {
  it('maps Present / Outside Location / Absent metric cards', () => {
    const state = new AdminRecordsState();
    state.applyResponse(
      samplePage({
        metrics: { present: 4, late: 0, absent: 2, outsideLocation: 1 },
      }),
    );

    const cards = state.metrics();
    expect(cards.map((card) => card.label)).toEqual([
      'Present',
      'Outside Location',
      'Absent',
    ]);
    expect(cards.map((card) => card.value)).toEqual(['4', '1', '2']);
    expect(cards.map((card) => card.icon)).toEqual([
      'present',
      'locations',
      'attendance',
    ]);
  });

  it('keeps attendance status on rows and fills it when the API omits it', () => {
    const state = new AdminRecordsState();
    const page = samplePage();
    const withoutStatus = {
      ...page.records[0],
      attendanceStatus: undefined as unknown as 'Present',
      status: 'Outside Location' as const,
    };
    state.applyResponse({
      ...page,
      records: [withoutStatus, page.records[1]],
    });

    expect(state.records()[0].attendanceStatus).toBe('Present');
    expect(state.records()[1].attendanceStatus).toBe('Absent');
  });

  it('exposes Inside/Outside status and Present/Absent attendance filters', () => {
    const state = new AdminRecordsState();

    expect(state.filters().statusOptions.map((option) => option.value)).toEqual([
      'all',
      'inside',
      'outside',
    ]);
    expect(state.filters().statusOptions.map((option) => option.label)).toEqual([
      'All statuses',
      'Inside',
      'Outside Location',
    ]);
    expect(
      state.filters().attendanceStatusOptions.map((option) => option.value),
    ).toEqual(['all', 'Present', 'Absent']);
  });
});

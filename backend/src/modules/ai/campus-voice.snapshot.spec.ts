import {
  ATTENDANCE_LOCATION_STATUS,
  ATTENDANCE_STATUS,
} from '../../common/constants/status.constant';
import {
  formatCampusVoiceSummary,
  formatStudentVoiceSummary,
  queryHasFilter,
  summarizeAttendance,
} from './campus-voice.snapshot';
import { CampusVoiceAttendanceRowDto } from './dto/campus-records-response.dto';

function attendanceRow(
  overrides: Partial<CampusVoiceAttendanceRowDto>,
): CampusVoiceAttendanceRowDto {
  return {
    student: 'Chihea',
    studentId: 'SC-1001',
    session: 'Morning',
    sessionId: 'ses-1',
    location: 'Building A-Room 201',
    scannedLocation: 'KIT',
    recordedAt: '2026-08-20T02:00:00.000Z',
    status: ATTENDANCE_LOCATION_STATUS.inside,
    attendanceStatus: ATTENDANCE_STATUS.present,
    distanceMeters: 12,
    ...overrides,
  };
}

describe('campus voice snapshot', () => {
  it('treats an empty query as unfiltered', () => {
    expect(queryHasFilter({})).toBe(false);
    expect(queryHasFilter({ scope: 'all', attendance_status: 'all' })).toBe(
      false,
    );
    expect(queryHasFilter({ attendance_status: 'Present' })).toBe(true);
    expect(queryHasFilter({ scope: 'dashboard' })).toBe(true);
    expect(queryHasFilter({ query: 'Chihea' })).toBe(true);
  });

  it('counts present, absent, inside, and outside from the full record set', () => {
    const attendance = summarizeAttendance([
      attendanceRow({}),
      attendanceRow({
        student: 'Dara',
        studentId: 'SC-1002',
        status: ATTENDANCE_LOCATION_STATUS.outsideLocation,
        attendanceStatus: ATTENDANCE_STATUS.present,
        distanceMeters: 3046,
        scannedLocation: 'Street 2011',
      }),
      attendanceRow({
        student: 'Sophea',
        studentId: 'SC-1003',
        status: null,
        attendanceStatus: ATTENDANCE_STATUS.absent,
        distanceMeters: null,
        scannedLocation: null,
      }),
    ]);

    expect(attendance).toMatchObject({
      total: 3,
      present: 2,
      absent: 1,
      inside: 1,
      outside: 1,
    });

    const spoken = formatCampusVoiceSummary({
      generatedAt: '2026-08-25T00:00:00.000Z',
      filtered: false,
      dashboard: {
        cards: [
          { label: 'Registered students', value: '3', helper: '' },
          { label: 'Open sessions', value: '1', helper: '' },
        ],
        trendYear: 2026,
        monthlyTrend: [],
        recentScans: [
          {
            student: 'Chihea',
            studentId: 'SC-1001',
            session: 'Morning',
            location: 'Building A-Room 201',
            status: ATTENDANCE_LOCATION_STATUS.inside,
            distanceMeters: 12,
            recordedAt: '2026-08-20T02:00:00.000Z',
          },
        ],
      },
      attendance,
      locations: {
        total: 2,
        inside: 1,
        outside: 1,
        visits: [
          {
            student: 'Chihea',
            studentId: 'SC-1001',
            session: 'Morning',
            locationName: 'Room 201',
            building: 'Building A',
            room: '201',
            scannedLocation: 'KIT',
            recordedAt: '2026-08-20T02:00:00.000Z',
            status: ATTENDANCE_LOCATION_STATUS.inside,
            distanceMeters: 12,
          },
        ],
        zones: [
          {
            id: 'LOC-001',
            name: 'Room 201',
            building: 'Building A',
            room: '201',
            radiusMeters: 80,
            status: 'Active',
            sessionsUsing: 1,
          },
        ],
      },
      sessions: {
        total: 1,
        open: 1,
        closed: 0,
        items: [
          {
            id: 'ses-1',
            title: 'Morning',
            status: 'Open',
            locationName: 'Building A-Room 201',
            teacherName: 'Teacher Kim',
            openedAt: '2026-08-20T01:00:00.000Z',
            dueAt: '2026-08-20T04:00:00.000Z',
            closedAt: null,
          },
        ],
      },
      students: {
        total: 3,
        loginEnabled: 3,
        loginDisabled: 0,
        items: [
          {
            studentId: 'SC-1001',
            name: 'Chihea',
            email: 'chihea@smartcampus.edu',
            course: 'SE401',
            year: 'Year 1',
            loginEnabled: true,
            hasAccount: true,
            attendanceRate: 90,
            status: 'Active',
          },
        ],
      },
    });

    expect(spoken).toContain('with no filter applied');
    expect(spoken).toContain('Dashboard: Registered students 3, Open sessions 1.');
    expect(spoken).toContain('3 records');
    expect(spoken).toContain('2 present');
    expect(spoken).toContain('1 absent');
    expect(spoken).toContain('1 inside the location');
    expect(spoken).toContain('1 outside the location');
    expect(spoken).toContain('Chihea');
    expect(spoken).toContain('12 meters');
    expect(spoken).toContain('Building A-Room 201');
    expect(spoken).toContain('80 meter radius');
    expect(spoken).toContain('SE401');
    expect(spoken).toContain('login enabled');
    expect(spoken).toContain('Ask for a student name');
  });

  it('reads matching names and distances in full when a filter is applied', () => {
    const attendance = summarizeAttendance([
      attendanceRow({ distanceMeters: 12 }),
    ]);
    const spoken = formatCampusVoiceSummary({
      generatedAt: '2026-08-25T00:00:00.000Z',
      filtered: true,
      dashboard: {
        cards: [],
        trendYear: 2026,
        monthlyTrend: [],
        recentScans: [],
      },
      attendance,
      locations: { total: 0, inside: 0, outside: 0, visits: [], zones: [] },
      sessions: { total: 0, open: 0, closed: 0, items: [] },
      students: { total: 0, loginEnabled: 0, loginDisabled: 0, items: [] },
    });

    expect(spoken).toContain('requested filter');
    expect(spoken).toContain('Chihea');
    expect(spoken).toContain('SC-1001');
    expect(spoken).toContain('12 meters');
    expect(spoken).toContain('Building A-Room 201');
    expect(spoken).toContain('Read every matching name and field');
    expect(spoken).not.toContain('Ask for a student name');
    expect(spoken).not.toContain('Location visits: 0');
    expect(spoken).not.toContain('Sessions: 0');
    expect(spoken).not.toContain('Students: 0');
  });

  it('speaks the signed-in student classes and location gate', () => {
    const spoken = formatStudentVoiceSummary({
      generatedAt: '2026-08-25T00:00:00.000Z',
      filtered: false,
      dashboard: {
        cards: [],
        trendYear: 2026,
        monthlyTrend: [],
        recentScans: [],
      },
      attendance: summarizeAttendance([attendanceRow({})]),
      locations: {
        total: 0,
        inside: 0,
        outside: 0,
        visits: [],
        zones: [
          {
            id: 'LOC-001',
            name: 'Building A-Room 201',
            building: 'Building A-Room 201',
            room: '',
            radiusMeters: 80,
            status: 'Active',
            sessionsUsing: 1,
          },
        ],
      },
      sessions: {
        total: 2,
        open: 2,
        closed: 0,
        items: [
          {
            id: 'ses-1',
            title: 'Morning',
            status: 'Open',
            locationName: 'Building A-Room 201',
            teacherName: 'Teacher Kim',
            openedAt: '2026-08-20T01:00:00.000Z',
            dueAt: '2026-12-20T04:00:00.000Z',
            closedAt: null,
            recorded: true,
            duePassed: false,
          },
          {
            id: 'ses-2',
            title: 'Afternoon lab',
            status: 'Open',
            locationName: 'Building A-Room 201',
            teacherName: 'Teacher Kim',
            openedAt: '2026-08-20T05:00:00.000Z',
            dueAt: '2026-12-20T08:00:00.000Z',
            closedAt: null,
            recorded: false,
            duePassed: false,
          },
        ],
      },
      students: {
        total: 1,
        loginEnabled: 1,
        loginDisabled: 0,
        items: [],
      },
    });

    expect(spoken).toContain("this student's own live classes");
    expect(spoken).toContain('already recorded');
    expect(spoken).toContain('not yet recorded');
    expect(spoken).toContain('Already recorded:');
    expect(spoken).toContain('Not yet recorded:');
    expect(spoken).toContain('Morning');
    expect(spoken).toContain('Afternoon lab');
    expect(spoken).toContain('80 meter radius');
    expect(spoken).toContain('Your recorded scans: 1');
    expect(spoken).toContain('Location permission is required');
    expect(spoken).not.toContain('Ask for a student name');
    expect(spoken).not.toContain('Dashboard:');
  });
});

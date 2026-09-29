import { Repository } from 'typeorm';
import { USER_ROLES } from '../../common/constants/roles.constant';
import { SESSION_STATUS } from '../../common/constants/session.constant';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { SessionEntity } from '../../database/entities/session.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { AttendanceService } from '../attendance/attendance.service';
import { AttendanceRecordResponseDto } from '../attendance/dto/attendance-record-response.dto';
import {
  DashboardService,
  buildMonthlyTrend,
  pickRecentScans,
} from './dashboard.service';

const teacher: AuthenticatedUser = {
  userId: 'u-teacher-1',
  role: USER_ROLES.teacher,
};

function scan(
  overrides: Partial<AttendanceRecordResponseDto>,
): AttendanceRecordResponseDto {
  return {
    id: 'att-1',
    student: 'Chihea',
    studentId: 'SC-1001',
    sessionId: 'ses-a',
    session: 'Teacher coming for today',
    location: 'Building A, Room 201',
    recordedAt: '2026-08-20T16:30:00.000Z',
    submittedAt: '2026-08-20T16:30:00.000Z',
    status: 'Outside Location',
    attendanceStatus: 'Present',
    distanceMeters: 2912,
    latitude: 11.528208,
    longitude: 104.92301,
    scannedLocation: 'Street 430, Boeung Trabek',
    accuracyMeters: 52,
    ...overrides,
  };
}

describe('buildMonthlyTrend', () => {
  it('puts campus-local August scans on Aug and leaves empty months at 0', () => {
    const trend = buildMonthlyTrend(
      [
        scan({ id: 'a', recordedAt: '2026-08-20T16:30:00.000Z' }),
        scan({
          id: 'b',
          student: 'Kim Weison',
          studentId: '2004',
          recordedAt: '2026-08-20T13:12:00.000Z',
        }),
      ],
      2026,
    );

    expect(trend).toHaveLength(12);
    expect(trend[0]).toEqual({
      month: 'Jan',
      presentRate: 0,
      present: 0,
      absent: 0,
      outsideLocation: 0,
    });
    expect(trend[7]).toEqual({
      month: 'Aug',
      presentRate: 100,
      present: 2,
      absent: 0,
      outsideLocation: 2,
    });
  });

  it('counts Outside Location scans as Present on the attendance-status series', () => {
    const trend = buildMonthlyTrend(
      [
        scan({ id: 'out', status: 'Outside Location', attendanceStatus: 'Present' }),
        scan({
          id: 'abs',
          status: null,
          attendanceStatus: 'Absent',
          distanceMeters: null,
        }),
      ],
      2026,
    );
    expect(trend[7].present).toBe(1);
    expect(trend[7].absent).toBe(1);
    expect(trend[7].presentRate).toBe(50);
    expect(trend[7].outsideLocation).toBe(1);
  });

  it('uses scanned / expected so absents pull the monthly rate down', () => {
    const trend = buildMonthlyTrend(
      [
        scan({ id: 'p', status: 'Inside', attendanceStatus: 'Present' }),
        scan({
          id: 'a',
          status: null,
          attendanceStatus: 'Absent',
          distanceMeters: null,
        }),
      ],
      2026,
    );
    expect(trend[7].presentRate).toBe(50);
    expect(trend[7].present).toBe(1);
    expect(trend[7].absent).toBe(1);
  });
});

describe('pickRecentScans', () => {
  it('keeps the newest scans and drops Absent rows', () => {
    const recent = pickRecentScans([
      scan({ id: 's1', status: 'Inside', attendanceStatus: 'Present' }),
      scan({
        id: 'abs',
        status: null,
        attendanceStatus: 'Absent',
        distanceMeters: null,
      }),
      scan({ id: 's2', student: 'Kim Weison', studentId: '2004' }),
    ]);
    expect(recent.map((row) => row.id)).toEqual(['s1', 's2']);
    expect(recent[0].location).toBe('Building A-Room 201');
  });
});

describe('DashboardService', () => {
  let service: DashboardService;
  let findAdminRecords: jest.Mock;
  let studentCount: jest.Mock;
  let sessionCount: jest.Mock;

  beforeEach(() => {
    findAdminRecords = jest.fn(async () => ({
      records: [
        scan({ id: 's1' }),
        scan({
          id: 'abs',
          status: null,
          attendanceStatus: 'Absent',
          distanceMeters: null,
        }),
      ],
      metrics: { present: 0, late: 0, absent: 1, outsideLocation: 1 },
      statusOptions: ['Inside', 'Outside Location'],
      attendanceStatusOptions: ['Present', 'Absent'],
    }));
    studentCount = jest.fn(async () => 3);
    sessionCount = jest.fn(async () => 2);

    service = new DashboardService(
      { findAdminRecords } as unknown as AttendanceService,
      { count: studentCount } as unknown as Repository<StudentEntity>,
      { count: sessionCount } as unknown as Repository<SessionEntity>,
    );
  });

  it('builds live cards, a 12-month series, and scan-only recents', async () => {
    const now = new Date('2026-08-20T16:45:00.000Z');
    const page = await service.getAdminDashboard(teacher, now);

    expect(findAdminRecords).toHaveBeenCalledWith({}, teacher, now);
    expect(page.trendYear).toBe(2026);
    expect(page.summaryCards[0].value).toBe('3');
    expect(page.summaryCards[1].label).toBe('Present today');
    expect(page.summaryCards[1].value).toBe('1');
    expect(page.summaryCards[2].value).toBe('50%');
    expect(page.summaryCards[3].value).toBe('2');
    expect(page.monthlyTrend).toHaveLength(12);
    expect(page.recentScans).toHaveLength(1);
    expect(page.recentScans[0].id).toBe('s1');
  });

  it('scopes open sessions to the teacher', async () => {
    const now = new Date('2026-08-20T16:45:00.000Z');
    await service.getAdminDashboard(teacher, now);
    expect(sessionCount).toHaveBeenCalledWith({
      where: { status: SESSION_STATUS.open, teacherId: teacher.userId },
    });
  });
});

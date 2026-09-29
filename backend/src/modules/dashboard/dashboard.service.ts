import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ATTENDANCE_LOCATION_STATUS,
  ATTENDANCE_STATUS,
} from '../../common/constants/status.constant';
import { USER_ROLES } from '../../common/constants/roles.constant';
import { SESSION_STATUS } from '../../common/constants/session.constant';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { campusDateParts, toIsoDate } from '../../common/utils/date.util';
import { formatCampusLocationLabel } from '../../common/utils/format.util';
import { AttendanceRecordEntity } from '../../database/entities/attendance-record.entity';
import { SessionEntity } from '../../database/entities/session.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { AttendanceService } from '../attendance/attendance.service';
import { AttendanceRecordResponseDto } from '../attendance/dto/attendance-record-response.dto';
import {
  AdminDashboardResponseDto,
  MonthlyAttendancePointDto,
  RecentScanDto,
} from './dto/dashboard-response.dto';

export const RECENT_SCAN_LIMIT = 10;

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

interface StatusTally {
  /** Attendance status Present (scanned on time, including outside-location scans). */
  present: number;
  /** Attendance status Absent (no scan by due time). */
  absent: number;
  /** Location status: scanned outside the geofence. */
  outsideLocation: number;
}

interface MonthlyAttendanceAggregate {
  month: string | number;
  present: string | number;
  absent: string | number;
  outsideLocation: string | number;
  todayPresent: string | number;
  todayAbsent: string | number;
  todayOutsideLocation: string | number;
}

const PRESENT_RECORD_SQL =
  '(record.attendance_status = :presentStatus OR (record.attendance_status IS NULL AND record.status IS NOT NULL AND record.status <> :legacyAbsentStatus))';
const ABSENT_RECORD_SQL =
  '(record.attendance_status = :absentStatus OR (record.attendance_status IS NULL AND (record.status IS NULL OR record.status = :legacyAbsentStatus)))';
const LEGACY_STATUS_PARAMETERS = {
  presentStatus: ATTENDANCE_STATUS.present,
  absentStatus: ATTENDANCE_STATUS.absent,
  legacyAbsentStatus: 'Absent',
  outsideStatus: ATTENDANCE_LOCATION_STATUS.outsideLocation,
};

@Injectable()
export class DashboardService {
  constructor(
    private readonly attendance: AttendanceService,
    @InjectRepository(AttendanceRecordEntity)
    private readonly records: Repository<AttendanceRecordEntity>,
    @InjectRepository(StudentEntity)
    private readonly students: Repository<StudentEntity>,
    @InjectRepository(SessionEntity)
    private readonly sessions: Repository<SessionEntity>,
  ) {}

  async getAdminDashboard(
    actor: AuthenticatedUser,
    now: Date = new Date(),
  ): Promise<AdminDashboardResponseDto> {
    // Keep due-session attendance counts current without fetching every record.
    await this.attendance.reconcileAbsents(actor, now);

    const trendYear = campusDateParts(now).year;
    const dateParts = campusDateParts(now);
    const yearStart = campusMidnightUtc(trendYear, 1, 1);
    const yearEnd = campusMidnightUtc(trendYear + 1, 1, 1);
    const todayStart = campusMidnightUtc(
      dateParts.year,
      dateParts.month,
      dateParts.day,
    );
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    // Dashboard cards and chart need aggregates, not every historical row.
    // recorded_at is stored as UTC; shift to Phnom Penh time for month grouping.
    const monthlyQuery = this.records
      .createQueryBuilder('record')
      .innerJoin(SessionEntity, 'session', 'session.id = record.session_id')
      .select('MONTH(DATE_ADD(record.recorded_at, INTERVAL 7 HOUR))', 'month')
      .addSelect(
        `SUM(CASE WHEN ${PRESENT_RECORD_SQL} THEN 1 ELSE 0 END)`,
        'present',
      )
      .addSelect(
        `SUM(CASE WHEN ${ABSENT_RECORD_SQL} THEN 1 ELSE 0 END)`,
        'absent',
      )
      .addSelect(
        'SUM(CASE WHEN record.status = :outsideStatus THEN 1 ELSE 0 END)',
        'outsideLocation',
      )
      .addSelect(
        `SUM(CASE WHEN record.recorded_at >= :todayStart AND record.recorded_at < :todayEnd AND ${PRESENT_RECORD_SQL} THEN 1 ELSE 0 END)`,
        'todayPresent',
      )
      .addSelect(
        `SUM(CASE WHEN record.recorded_at >= :todayStart AND record.recorded_at < :todayEnd AND ${ABSENT_RECORD_SQL} THEN 1 ELSE 0 END)`,
        'todayAbsent',
      )
      .addSelect(
        'SUM(CASE WHEN record.recorded_at >= :todayStart AND record.recorded_at < :todayEnd AND record.status = :outsideStatus THEN 1 ELSE 0 END)',
        'todayOutsideLocation',
      )
      .where('record.recorded_at >= :yearStart', { yearStart })
      .andWhere('record.recorded_at < :yearEnd', { yearEnd })
      .groupBy('MONTH(DATE_ADD(record.recorded_at, INTERVAL 7 HOUR))')
      .setParameters({
        ...LEGACY_STATUS_PARAMETERS,
        todayStart,
        todayEnd,
      });

    const recentQuery = this.records
      .createQueryBuilder('record')
      .innerJoin(SessionEntity, 'session', 'session.id = record.session_id')
      .where(PRESENT_RECORD_SQL)
      .orderBy('record.recorded_at', 'DESC')
      .take(RECENT_SCAN_LIMIT)
      .setParameters(LEGACY_STATUS_PARAMETERS);

    if (actor.role === USER_ROLES.teacher) {
      monthlyQuery.andWhere('session.teacher_id = :teacherId', {
        teacherId: actor.userId,
      });
      recentQuery.andWhere('session.teacher_id = :teacherId', {
        teacherId: actor.userId,
      });
    }

    const [monthlyRows, recentRows, studentCount, openSessionCount] =
      await Promise.all([
        monthlyQuery.getRawMany<MonthlyAttendanceAggregate>(),
        recentQuery.getMany(),
        this.students.count(),
        this.sessions.count({
          where:
            actor.role === USER_ROLES.teacher
              ? { status: SESSION_STATUS.open, teacherId: actor.userId }
              : { status: SESSION_STATUS.open },
        }),
      ]);

    const today = monthlyRows.reduce<StatusTally>(
      (counts, row) => ({
        present: counts.present + toNumber(row.todayPresent),
        absent: counts.absent + toNumber(row.todayAbsent),
        outsideLocation:
          counts.outsideLocation + toNumber(row.todayOutsideLocation),
      }),
      { present: 0, absent: 0, outsideLocation: 0 },
    );
    const todayRate = checkInRate(today);

    return {
      title: 'SmartCampus Attendance System',
      subtitle:
        'Live view of identity-verified scans, time stamps, location checks, and attendance status.',
      summaryCards: [
        {
          label: 'Registered students',
          value: formatCount(studentCount),
          helper: 'Authorised student accounts',
          icon: 'students',
          tone: 'blue',
        },
        {
          label: 'Present today',
          value: formatCount(today.present),
          helper: 'Attendance marked before the due time',
          icon: 'present',
          tone: 'green',
        },
        {
          label: 'Attendance rate',
          value: `${todayRate}%`,
          helper: outsideHelper(today.outsideLocation),
          icon: 'attendance',
          tone: 'amber',
        },
        {
          label: 'Open sessions',
          value: formatCount(openSessionCount),
          helper: 'Active scan codes for classes',
          icon: 'sessions',
          tone: 'violet',
        },
      ],
      monthlyTrend: buildMonthlyTrendFromAggregates(monthlyRows),
      trendYear,
      recentScans: recentRows.map((row) =>
        toRecentScan({
          id: row.id,
          student: row.student,
          studentId: row.studentId,
          sessionId: row.sessionId,
          session: row.session,
          location: row.location,
          recordedAt: toIsoDate(row.recordedAt),
          submittedAt: toIsoDate(row.recordedAt),
          status: row.status,
          attendanceStatus: ATTENDANCE_STATUS.present,
          distanceMeters: row.distanceMeters,
          latitude: row.latitude ?? null,
          longitude: row.longitude ?? null,
          scannedLocation: row.scannedLocation ?? null,
          accuracyMeters: row.accuracyMeters ?? null,
        }),
      ),
    };
  }
}

function buildMonthlyTrendFromAggregates(
  rows: MonthlyAttendanceAggregate[],
): MonthlyAttendancePointDto[] {
  const byMonth = new Map(rows.map((row) => [Number(row.month), row]));

  return MONTH_LABELS.map((month, index) => {
    const row = byMonth.get(index + 1);
    const counts = {
      present: toNumber(row?.present),
      absent: toNumber(row?.absent),
      outsideLocation: toNumber(row?.outsideLocation),
    };
    return {
      month,
      presentRate: checkInRate(counts),
      ...counts,
    };
  });
}

function campusMidnightUtc(year: number, month: number, day: number): Date {
  // Asia/Phnom_Penh uses UTC+07:00 year-round.
  return new Date(Date.UTC(year, month - 1, day) - 7 * 60 * 60 * 1000);
}

function toNumber(value: string | number | null | undefined): number {
  return Number(value ?? 0);
}

export function buildMonthlyTrend(
  records: AttendanceRecordResponseDto[],
  year: number,
): MonthlyAttendancePointDto[] {
  const buckets: AttendanceRecordResponseDto[][] = MONTH_LABELS.map(() => []);
  for (const row of records) {
    const recorded = new Date(row.recordedAt);
    if (Number.isNaN(recorded.getTime())) {
      continue;
    }
    const parts = campusDateParts(recorded);
    if (parts.year !== year) {
      continue;
    }
    buckets[parts.month - 1].push(row);
  }

  return MONTH_LABELS.map((month, index) => {
    const counts = tally(buckets[index]);
    return {
      month,
      presentRate: checkInRate(counts),
      present: counts.present,
      absent: counts.absent,
      outsideLocation: counts.outsideLocation,
    };
  });
}

export function pickRecentScans(
  records: AttendanceRecordResponseDto[],
  limit = RECENT_SCAN_LIMIT,
): RecentScanDto[] {
  return records
    .filter((row) => row.attendanceStatus !== ATTENDANCE_STATUS.absent)
    .slice(0, limit)
    .map(toRecentScan);
}

function toRecentScan(row: AttendanceRecordResponseDto): RecentScanDto {
  return {
    id: row.id,
    student: row.student,
    studentId: row.studentId,
    session: row.session,
    location: formatCampusLocationLabel(row.location),
    submittedAt: row.recordedAt,
    recordedAt: row.recordedAt,
    status: row.status,
    distanceMeters: row.distanceMeters,
  };
}

function tally(rows: AttendanceRecordResponseDto[]): StatusTally {
  const counts: StatusTally = {
    present: 0,
    absent: 0,
    outsideLocation: 0,
  };
  for (const row of rows) {
    if (row.attendanceStatus === ATTENDANCE_STATUS.absent) {
      counts.absent += 1;
    } else if (row.attendanceStatus === ATTENDANCE_STATUS.present) {
      counts.present += 1;
    }

    if (row.status === ATTENDANCE_LOCATION_STATUS.outsideLocation) {
      counts.outsideLocation += 1;
    }
  }
  return counts;
}

/** Present / (Present + Absent). Outside / inside location is not part of this rate. */
function checkInRate(counts: Pick<StatusTally, 'present' | 'absent'>): number {
  const expected = counts.present + counts.absent;
  if (expected === 0) {
    return 0;
  }
  return Math.round((100 * counts.present) / expected);
}

function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

function outsideHelper(outside: number): string {
  if (outside === 0) {
    return 'No outside-location scans today';
  }
  if (outside === 1) {
    return '1 outside location';
  }
  return `${outside} outside location`;
}

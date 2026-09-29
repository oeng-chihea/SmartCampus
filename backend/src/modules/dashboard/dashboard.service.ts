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
import { campusDateParts, isSameCampusDay } from '../../common/utils/date.util';
import { formatCampusLocationLabel } from '../../common/utils/format.util';
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

@Injectable()
export class DashboardService {
  constructor(
    private readonly attendance: AttendanceService,
    @InjectRepository(StudentEntity)
    private readonly students: Repository<StudentEntity>,
    @InjectRepository(SessionEntity)
    private readonly sessions: Repository<SessionEntity>,
  ) {}

  async getAdminDashboard(
    actor: AuthenticatedUser,
    now: Date = new Date(),
  ): Promise<AdminDashboardResponseDto> {
    const page = await this.attendance.findAdminRecords({}, actor, now);
    const records = page.records;
    const trendYear = campusDateParts(now).year;
    const today = tally(records.filter((row) => isToday(row.recordedAt, now)));
    const todayRate = checkInRate(today);
    const studentCount = await this.students.count();
    const openSessionCount = await this.sessions.count({
      where:
        actor.role === USER_ROLES.teacher
          ? { status: SESSION_STATUS.open, teacherId: actor.userId }
          : { status: SESSION_STATUS.open },
    });

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
      monthlyTrend: buildMonthlyTrend(records, trendYear),
      trendYear,
      recentScans: pickRecentScans(records),
    };
  }
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

function isToday(iso: string, now: Date): boolean {
  const recorded = new Date(iso);
  if (Number.isNaN(recorded.getTime())) {
    return false;
  }
  return isSameCampusDay(recorded, now);
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

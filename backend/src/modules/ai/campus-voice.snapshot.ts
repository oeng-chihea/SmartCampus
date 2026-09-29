import {
  ATTENDANCE_LOCATION_STATUS,
  ATTENDANCE_STATUS,
} from '../../common/constants/status.constant';
import { SESSION_STATUS } from '../../common/constants/session.constant';
import { campusDateParts } from '../../common/utils/date.util';
import { formatCampusLocationLabel } from '../../common/utils/format.util';
import { CampusRecordsQueryDto } from './dto/campus-records-query.dto';
import {
  CampusRecordsResponseDto,
  CampusVoiceAttendanceRowDto,
  CampusVoiceAttendanceSummaryDto,
  CampusVoiceDashboardSummaryDto,
  CampusVoiceLocationSummaryDto,
  CampusVoiceSessionRowDto,
  CampusVoiceSessionSummaryDto,
  CampusVoiceStudentRowDto,
  CampusVoiceStudentSummaryDto,
  CampusVoiceVisitRowDto,
  CampusVoiceZoneRowDto,
} from './dto/campus-records-response.dto';

/** Compact spoken name list when the teacher asked for every record. */
export const SPOKEN_LIST_LIMIT = 12;

/** Structured rows kept in an unfiltered snapshot for Gemini Live. */
export const SNAPSHOT_ROW_LIMIT = 40;

export function queryHasFilter(query: CampusRecordsQueryDto): boolean {
  return Boolean(
    (query.scope && query.scope !== 'all') ||
      String(query.query ?? '').trim() ||
      (query.attendance_status && query.attendance_status !== 'all') ||
      (query.location_status && query.location_status !== 'all') ||
      (query.date_filter && query.date_filter !== 'all') ||
      String(query.building ?? '').trim() ||
      String(query.session_id ?? '').trim() ||
      String(query.session_query ?? '').trim(),
  );
}

export function emptyDashboard(): CampusVoiceDashboardSummaryDto {
  return {
    cards: [],
    trendYear: 0,
    monthlyTrend: [],
    recentScans: [],
  };
}

export function emptyAttendance(): CampusVoiceAttendanceSummaryDto {
  return {
    total: 0,
    present: 0,
    absent: 0,
    inside: 0,
    outside: 0,
    records: [],
  };
}

export function emptyLocations(): CampusVoiceLocationSummaryDto {
  return { total: 0, inside: 0, outside: 0, visits: [], zones: [] };
}

export function emptySessions(): CampusVoiceSessionSummaryDto {
  return { total: 0, open: 0, closed: 0, items: [] };
}

export function emptyStudents(): CampusVoiceStudentSummaryDto {
  return { total: 0, loginEnabled: 0, loginDisabled: 0, items: [] };
}

export function summarizeAttendance(
  records: CampusVoiceAttendanceRowDto[],
): CampusVoiceAttendanceSummaryDto {
  return {
    total: records.length,
    present: records.filter(
      (row) => row.attendanceStatus === ATTENDANCE_STATUS.present,
    ).length,
    absent: records.filter(
      (row) => row.attendanceStatus === ATTENDANCE_STATUS.absent,
    ).length,
    inside: records.filter(
      (row) => row.status === ATTENDANCE_LOCATION_STATUS.inside,
    )
      .length,
    outside: records.filter(
      (row) => row.status === ATTENDANCE_LOCATION_STATUS.outsideLocation,
    ).length,
    records,
  };
}

export function summarizeLocations(
  visits: CampusVoiceVisitRowDto[],
  zones: CampusVoiceZoneRowDto[] = [],
): CampusVoiceLocationSummaryDto {
  return {
    total: visits.length,
    inside: visits.filter(
      (row) => row.status === ATTENDANCE_LOCATION_STATUS.inside,
    )
      .length,
    outside: visits.filter(
      (row) => row.status === ATTENDANCE_LOCATION_STATUS.outsideLocation,
    ).length,
    visits,
    zones,
  };
}

export function summarizeSessions(
  items: CampusVoiceSessionRowDto[],
): CampusVoiceSessionSummaryDto {
  return {
    total: items.length,
    open: items.filter((row) => row.status === SESSION_STATUS.open).length,
    closed: items.filter((row) => row.status === SESSION_STATUS.closed).length,
    items,
  };
}

export function summarizeStudents(
  items: CampusVoiceStudentRowDto[],
): CampusVoiceStudentSummaryDto {
  return {
    total: items.length,
    loginEnabled: items.filter((row) => row.loginEnabled).length,
    loginDisabled: items.filter((row) => !row.loginEnabled).length,
    items,
  };
}

export function capSnapshotRows<T>(rows: T[], filtered: boolean): T[] {
  if (filtered || rows.length <= SNAPSHOT_ROW_LIMIT) {
    return rows;
  }
  return rows.slice(0, SNAPSHOT_ROW_LIMIT);
}

export function formatCampusVoiceSummary(
  snapshot: Omit<CampusRecordsResponseDto, 'spokenSummary'>,
): string {
  const lead = snapshot.filtered
    ? 'These counts use the requested filter. Read every matching name and field.'
    : 'These counts are for every record, with no filter applied.';
  const attendance = snapshot.attendance;
  const locations = snapshot.locations;
  const sessions = snapshot.sessions;
  const students = snapshot.students;
  const dashboard = snapshot.dashboard ?? emptyDashboard();
  const detailed = snapshot.filtered;
  const listLimit = detailed ? SNAPSHOT_ROW_LIMIT : SPOKEN_LIST_LIMIT;

  const attendanceBlock = attendance.total
    ? [
        `Attendance has ${attendance.total} records: ${attendance.present} present, ${attendance.absent} absent, ${attendance.inside} inside the location, and ${attendance.outside} outside the location.`,
        ...attendance.records
          .slice(0, listLimit)
          .map((row) => attendanceDetailLine(row)),
        extraLine(
          'attendance records',
          attendance.total,
          Math.min(attendance.records.length, listLimit),
        ),
      ]
    : [];
  const visitBlock = locations.total
    ? [
        `Location visits: ${locations.total} total, ${locations.inside} inside, ${locations.outside} outside.`,
        ...locations.visits
          .slice(0, listLimit)
          .map((row) => visitDetailLine(row)),
        extraLine(
          'location visits',
          locations.total,
          Math.min(locations.visits.length, listLimit),
        ),
      ]
    : [];
  const sessionBlock = sessions.total
    ? [
        `Sessions: ${sessions.open} open, ${sessions.closed} closed.`,
        ...sessions.items.slice(0, listLimit).map((row) => sessionDetailLine(row)),
        extraLine(
          'sessions',
          sessions.total,
          Math.min(sessions.items.length, listLimit),
        ),
      ]
    : [];
  const studentBlock = students.total
    ? [
        `Students: ${students.total} in the directory, ${students.loginEnabled} can log in.`,
        ...students.items.slice(0, listLimit).map((row) => studentDetailLine(row)),
        extraLine(
          'students',
          students.total,
          Math.min(students.items.length, listLimit),
        ),
      ]
    : [];

  return [
    lead,
    dashboardLine(dashboard),
    recentScanLine(dashboard.recentScans, listLimit),
    ...attendanceBlock,
    ...visitBlock,
    zoneLine(locations.zones ?? [], listLimit),
    ...sessionBlock,
    ...studentBlock,
    detailed
      ? ''
      : 'Ask for a student name, student ID, session, or building to hear every field for that record.',
  ]
    .filter(Boolean)
    .join(' ');
}

/** Spoken snapshot for the signed-in student — their classes and scans only. */
export function formatStudentVoiceSummary(
  snapshot: Omit<CampusRecordsResponseDto, 'spokenSummary'>,
): string {
  const attendance = snapshot.attendance;
  const sessions = snapshot.sessions;
  const zones = snapshot.locations.zones ?? [];
  const listLimit = snapshot.filtered ? SNAPSHOT_ROW_LIMIT : SPOKEN_LIST_LIMIT;
  const lead = snapshot.filtered
    ? 'These are this student\'s matching records.'
    : 'These are this student\'s own live classes and recorded scans. Other students are not included.';

  const recordedLive = sessions.items.filter((row) => row.recorded);
  const notRecorded = sessions.items.filter((row) => row.recorded === false);
  const sessionBlock = sessions.total
    ? [
        `Open classes: ${sessions.open}. ${recordedLive.length} already recorded, ${notRecorded.length} not yet recorded.`,
        recordedLive.length
          ? `Already recorded: ${recordedLive
              .slice(0, listLimit)
              .map((row) => sessionDetailLine(row))
              .join(' ')}`
          : 'No live class is already recorded.',
        notRecorded.length
          ? `Not yet recorded: ${notRecorded
              .slice(0, listLimit)
              .map((row) => sessionDetailLine(row))
              .join(' ')}`
          : 'Every live class is already recorded.',
        extraLine(
          'open classes',
          sessions.total,
          Math.min(sessions.items.length, listLimit),
        ),
      ]
    : ['No live class is open yet. Ask the teacher to create a session.'];

  const scanBlock = attendance.total
    ? [
        `Your recorded scans: ${attendance.total}. ${attendance.inside} inside the location, ${attendance.outside} outside the location.`,
        ...attendance.records
          .slice(0, listLimit)
          .map((row) => attendanceDetailLine(row)),
        extraLine(
          'recorded scans',
          attendance.total,
          Math.min(attendance.records.length, listLimit),
        ),
      ]
    : ['You have no recorded scans yet.'];

  return [
    lead,
    ...sessionBlock,
    zoneLine(zones, listLimit),
    ...scanBlock,
    'Location permission is required to mark present. If GPS is blocked, no check-in is sent and the class becomes Absent after due time.',
  ]
    .filter(Boolean)
    .join(' ');
}

export function attendanceDetailLine(row: CampusVoiceAttendanceRowDto): string {
  return compactJoin([
    row.student,
    row.studentId,
    row.session,
    row.location,
    row.attendanceStatus,
    row.status === ATTENDANCE_LOCATION_STATUS.outsideLocation
      ? 'outside the location'
      : row.status === ATTENDANCE_LOCATION_STATUS.inside
        ? 'inside the location'
        : '',
    speakDistance(row.distanceMeters),
    row.scannedLocation ? `scanned at ${row.scannedLocation}` : '',
    speakCampusTime(row.recordedAt),
  ]);
}

export function visitDetailLine(row: CampusVoiceVisitRowDto): string {
  const place = formatCampusLocationLabel(row.building, row.room) || row.locationName;
  return compactJoin([
    row.student,
    row.studentId,
    row.session,
    place,
    row.building,
    row.status === ATTENDANCE_LOCATION_STATUS.outsideLocation
      ? 'outside the location'
      : row.status === ATTENDANCE_LOCATION_STATUS.inside
        ? 'inside the location'
        : 'location status unavailable',
    speakDistance(row.distanceMeters),
    row.scannedLocation ? `scanned at ${row.scannedLocation}` : '',
    speakCampusTime(row.recordedAt),
  ]);
}

function dashboardLine(dashboard: CampusVoiceDashboardSummaryDto): string {
  if (!dashboard.cards.length) {
    return '';
  }
  const cards = dashboard.cards
    .map((card) => `${card.label} ${card.value}`)
    .join(', ');
  return `Dashboard: ${cards}.`;
}

function recentScanLine(
  scans: CampusVoiceDashboardSummaryDto['recentScans'],
  limit: number,
): string {
  if (!scans.length) {
    return '';
  }
  const shown = scans.slice(0, limit).map((row) =>
    compactJoin([
      row.student,
      row.session,
      row.location,
      row.status,
      speakDistance(row.distanceMeters),
    ]),
  );
  return `Recent scans: ${shown.join('; ')}.`;
}

function zoneLine(zones: CampusVoiceZoneRowDto[], limit: number): string {
  if (!zones.length) {
    return '';
  }
  const shown = zones.slice(0, limit).map((zone) =>
    compactJoin([
      formatCampusLocationLabel(zone.building, zone.room) || zone.name,
      `${zone.radiusMeters} meter radius`,
      zone.status,
    ]),
  );
  return `Campus zones: ${shown.join('; ')}.`;
}

function sessionDetailLine(row: CampusVoiceSessionRowDto): string {
  return compactJoin([
    row.title,
    row.status,
    row.locationName,
    row.teacherName,
    row.recorded === true
      ? 'already recorded'
      : row.recorded === false
        ? 'not yet recorded'
        : '',
    row.duePassed ? 'due passed, cannot mark present' : '',
    row.dueAt ? `due ${speakCampusTime(row.dueAt)}` : '',
    row.openedAt ? `opened ${speakCampusTime(row.openedAt)}` : '',
  ]);
}

function studentDetailLine(row: CampusVoiceStudentRowDto): string {
  return compactJoin([
    row.name,
    row.studentId,
    row.course,
    row.year,
    row.email,
    row.loginEnabled ? 'login enabled' : 'login disabled',
    row.hasAccount ? 'has account' : 'no account',
  ]);
}

function extraLine(label: string, total: number, shown: number): string {
  const extra = total - shown;
  if (extra <= 0) {
    return '';
  }
  return `${extra} more ${label} not listed.`;
}

function speakDistance(meters: number | null | undefined): string {
  if (meters == null || !Number.isFinite(meters)) {
    return '';
  }
  return `${Math.round(meters)} meters`;
}

function speakCampusTime(iso: string | null | undefined): string {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const parts = campusDateParts(date);
  const hour12 = parts.hour % 12 || 12;
  const suffix = parts.hour >= 12 ? 'Pm' : 'Am';
  const minute = String(parts.minute).padStart(2, '0');
  return `${parts.month}-${parts.day}-${String(parts.year).slice(-2)}-${hour12}:${minute}${suffix}`;
}

function compactJoin(parts: Array<string | null | undefined>): string {
  return `${parts.filter((part) => String(part ?? '').trim()).join(', ')}.`;
}

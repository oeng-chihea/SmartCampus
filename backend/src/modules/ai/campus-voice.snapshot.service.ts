import { Injectable } from '@nestjs/common';
import { USER_ROLES } from '../../common/constants/roles.constant';
import { SESSION_STATUS } from '../../common/constants/session.constant';
import { ATTENDANCE_STATUS } from '../../common/constants/status.constant';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { formatCampusLocationLabel } from '../../common/utils/format.util';
import { AttendanceService } from '../attendance/attendance.service';
import { AdminAttendanceFilterDto } from '../attendance/dto/admin-attendance-filter.dto';
import { DashboardService } from '../dashboard/dashboard.service';
import { LocationVisitFilterDto } from '../locations/dto/location-visit-filter.dto';
import { LocationsService } from '../locations/locations.service';
import { SessionsService } from '../sessions/sessions.service';
import { StudentsService } from '../students/students.service';
import {
  capSnapshotRows,
  emptyAttendance,
  emptyDashboard,
  emptyLocations,
  emptySessions,
  emptyStudents,
  formatCampusVoiceSummary,
  formatStudentVoiceSummary,
  queryHasFilter,
  summarizeAttendance,
  summarizeLocations,
  summarizeSessions,
  summarizeStudents,
} from './campus-voice.snapshot';
import { CampusRecordScope, CampusRecordsQueryDto } from './dto/campus-records-query.dto';
import {
  CampusRecordsResponseDto,
  CampusVoiceAttendanceRowDto,
  CampusVoiceDashboardSummaryDto,
  CampusVoiceLocationSummaryDto,
  CampusVoiceSessionRowDto,
  CampusVoiceStudentRowDto,
  CampusVoiceVisitRowDto,
  CampusVoiceZoneRowDto,
} from './dto/campus-records-response.dto';

@Injectable()
export class CampusVoiceSnapshotService {
  constructor(
    private readonly attendance: AttendanceService,
    private readonly locations: LocationsService,
    private readonly sessions: SessionsService,
    private readonly students: StudentsService,
    private readonly dashboard: DashboardService,
  ) {}

  async readCampusRecords(
    actor: AuthenticatedUser,
    query: CampusRecordsQueryDto = {},
  ): Promise<CampusRecordsResponseDto> {
    if (actor.role === USER_ROLES.student) {
      return this.readStudentRecords(actor, query);
    }

    const scope = query.scope ?? 'all';
    const filtered = queryHasFilter(query);
    const [dashboard, attendance, locations, sessions, students] =
      await Promise.all([
        this.includes(scope, 'dashboard')
          ? this.loadDashboard(actor, query)
          : emptyDashboard(),
        this.includes(scope, 'attendance')
          ? this.loadAttendance(actor, query)
          : emptyAttendance(),
        this.includes(scope, 'locations')
          ? this.loadLocations(actor, query)
          : emptyLocations(),
        this.includes(scope, 'sessions')
          ? this.loadSessions(actor, query)
          : emptySessions(),
        this.includes(scope, 'students')
          ? this.loadStudents(query)
          : emptyStudents(),
      ]);

    const snapshot = {
      generatedAt: new Date().toISOString(),
      filtered,
      dashboard: {
        ...dashboard,
        recentScans: capSnapshotRows(dashboard.recentScans, filtered),
      },
      attendance: {
        ...attendance,
        records: capSnapshotRows(attendance.records, filtered),
      },
      locations: {
        ...locations,
        visits: capSnapshotRows(locations.visits, filtered),
        zones: capSnapshotRows(locations.zones, filtered),
      },
      sessions: {
        ...sessions,
        items: capSnapshotRows(sessions.items, filtered),
      },
      students: {
        ...students,
        items: capSnapshotRows(students.items, filtered),
      },
    };

    return {
      ...snapshot,
      spokenSummary: formatCampusVoiceSummary(snapshot),
    };
  }

  /**
   * Student Campus Voice only sees this student's open classes and scans.
   * Teacher directory, dashboard, visit log, and other students stay hidden.
   */
  private async readStudentRecords(
    actor: AuthenticatedUser,
    query: CampusRecordsQueryDto,
  ): Promise<CampusRecordsResponseDto> {
    const scope = query.scope ?? 'all';
    const filtered = queryHasFilter(query);
    const [mine, live, profile] = await Promise.all([
      this.attendance.findMine(actor),
      this.loadStudentSessions(query),
      this.students.findByUserId(actor.userId),
    ]);

    const recordedIds = new Set(mine.map((row) => row.sessionId));
    const now = Date.now();
    const annotatedItems = live.sessions.items.map((row) => ({
      ...row,
      recorded: recordedIds.has(row.id),
      duePassed: isDuePassed(row.dueAt, now),
    }));
    const keepAttendance = this.includes(scope, 'attendance');
    const keepSessions = this.includes(scope, 'sessions');
    const attendanceSlice = keepAttendance
      ? this.summarizeStudentAttendance(mine, query)
      : emptyAttendance();
    const sessionItems = keepSessions ? annotatedItems : [];
    const sessionSummary = keepSessions
      ? summarizeSessions(sessionItems)
      : emptySessions();
    const zones = keepSessions ? live.zones : [];

    const students = profile
      ? summarizeStudents([
          {
            studentId: profile.studentId,
            name: profile.name,
            email: profile.email,
            course: profile.course,
            year: profile.year,
            loginEnabled: profile.loginEnabled,
            hasAccount: Boolean(profile.userId),
            attendanceRate: profile.attendanceRate,
            status: profile.status,
          },
        ])
      : emptyStudents();

    const snapshot = {
      generatedAt: new Date().toISOString(),
      filtered,
      dashboard: emptyDashboard(),
      attendance: {
        ...attendanceSlice,
        records: capSnapshotRows(attendanceSlice.records, filtered),
      },
      locations: summarizeLocations(
        [],
        capSnapshotRows(zones, filtered),
      ),
      sessions: {
        ...sessionSummary,
        items: capSnapshotRows(sessionSummary.items, filtered),
      },
      students: {
        ...students,
        items: capSnapshotRows(students.items, filtered),
      },
    };

    return {
      ...snapshot,
      spokenSummary: formatStudentVoiceSummary(snapshot),
    };
  }

  private summarizeStudentAttendance(
    mine: Awaited<ReturnType<AttendanceService['findMine']>>,
    query: CampusRecordsQueryDto,
  ) {
    const needle = this.searchNeedle(query);
    const sessionNeedle = String(query.session_query ?? query.session_id ?? '')
      .trim()
      .toLowerCase();
    const records = mine
      .filter((row) => {
        if (
          needle &&
          !this.matchesNeedle(needle, [
            row.student,
            row.studentId,
            row.session,
            row.location,
            row.scannedLocation,
          ])
        ) {
          return false;
        }
        if (!sessionNeedle) {
          return true;
        }
        return (
          row.session.toLowerCase().includes(sessionNeedle) ||
          row.sessionId.toLowerCase().includes(sessionNeedle)
        );
      })
      .map(
        (row): CampusVoiceAttendanceRowDto => ({
          student: row.student,
          studentId: row.studentId,
          session: row.session,
          sessionId: row.sessionId,
          location: row.location,
          scannedLocation: row.scannedLocation ?? null,
          recordedAt: row.recordedAt,
          status: row.status,
          attendanceStatus: row.attendanceStatus,
          distanceMeters: row.distanceMeters ?? null,
        }),
      );

    return summarizeAttendance(records);
  }

  private async loadStudentSessions(query: CampusRecordsQueryDto): Promise<{
    sessions: ReturnType<typeof summarizeSessions>;
    zones: CampusVoiceZoneRowDto[];
  }> {
    const needle = String(query.query ?? query.session_query ?? '')
      .trim()
      .toLowerCase();
    const sessionId = String(query.session_id ?? '').trim();
    const live = (await this.sessions.listOpenLive()).filter((row) => {
      if (sessionId && row.id !== sessionId) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return this.matchesNeedle(needle, [
        row.title,
        row.id,
        row.locationName,
        row.teacherName,
      ]);
    });

    const items = live.map(
      (row): CampusVoiceSessionRowDto => ({
        id: row.id,
        title: row.title,
        status: SESSION_STATUS.open,
        locationName: row.locationName,
        teacherName: row.teacherName,
        openedAt: row.openedAt,
        dueAt: row.dueAt,
        closedAt: null,
      }),
    );
    const seen = new Set<string>();
    const zones: CampusVoiceZoneRowDto[] = [];
    for (const row of live) {
      if (seen.has(row.locationId)) {
        continue;
      }
      seen.add(row.locationId);
      zones.push({
        id: row.locationId,
        name: row.locationName,
        building: row.locationName,
        room: '',
        radiusMeters: row.radiusMeters,
        status: 'Active',
        sessionsUsing: 1,
      });
    }

    return { sessions: summarizeSessions(items), zones };
  }

  private includes(scope: CampusRecordScope, page: CampusRecordScope): boolean {
    return scope === 'all' || scope === page;
  }

  private async loadDashboard(
    actor: AuthenticatedUser,
    query: CampusRecordsQueryDto,
  ): Promise<CampusVoiceDashboardSummaryDto> {
    const page = await this.dashboard.getAdminDashboard(actor);
    const needle = this.searchNeedle(query);
    const recentScans = page.recentScans
      .filter((row) => {
        if (!needle) {
          return true;
        }
        return this.matchesNeedle(needle, [
          row.student,
          row.studentId,
          row.session,
          row.location,
        ]);
      })
      .map((row) => ({
        student: row.student,
        studentId: row.studentId,
        session: row.session,
        location: row.location,
        status: row.status,
        distanceMeters: row.distanceMeters,
        recordedAt: row.recordedAt,
      }));

    return {
      cards: page.summaryCards.map((card) => ({
        label: card.label,
        value: card.value,
        helper: card.helper,
      })),
      trendYear: page.trendYear,
      monthlyTrend: page.monthlyTrend.map((point) => ({
        month: point.month,
        presentRate: point.presentRate,
        present: point.present,
        absent: point.absent,
        outsideLocation: point.outsideLocation,
      })),
      recentScans,
    };
  }

  private async loadAttendance(
    actor: AuthenticatedUser,
    query: CampusRecordsQueryDto,
  ) {
    const dto: AdminAttendanceFilterDto = {};
    const search = String(query.query ?? '').trim();
    if (search) {
      dto.search = search;
    }
    const sessionId = String(query.session_id ?? '').trim();
    if (sessionId) {
      dto.sessionId = sessionId;
    }
    if (query.attendance_status === ATTENDANCE_STATUS.present) {
      dto.attendanceStatus = ATTENDANCE_STATUS.present;
    } else if (query.attendance_status === ATTENDANCE_STATUS.absent) {
      dto.attendanceStatus = ATTENDANCE_STATUS.absent;
    }
    if (query.location_status === 'inside' || query.location_status === 'outside') {
      dto.status = query.location_status;
    }
    if (
      query.date_filter === 'today' ||
      query.date_filter === 'yesterday' ||
      query.date_filter === 'week'
    ) {
      dto.date = query.date_filter;
    }

    const page = await this.attendance.findAdminRecords(dto, actor);
    const sessionNeedle = String(query.session_query ?? '').trim().toLowerCase();
    const records = page.records
      .filter((row) => {
        if (!sessionNeedle) {
          return true;
        }
        return (
          row.session.toLowerCase().includes(sessionNeedle) ||
          row.sessionId.toLowerCase().includes(sessionNeedle)
        );
      })
      .map(
        (row): CampusVoiceAttendanceRowDto => ({
          student: row.student,
          studentId: row.studentId,
          session: row.session,
          sessionId: row.sessionId,
          location: row.location,
          scannedLocation: row.scannedLocation ?? null,
          recordedAt: row.recordedAt,
          status: row.status,
          attendanceStatus: row.attendanceStatus,
          distanceMeters: row.distanceMeters ?? null,
        }),
      );

    return summarizeAttendance(records);
  }

  private async loadLocations(
    actor: AuthenticatedUser,
    query: CampusRecordsQueryDto,
  ): Promise<CampusVoiceLocationSummaryDto> {
    const dto: LocationVisitFilterDto = {};
    const search = String(query.query ?? '').trim();
    if (search) {
      dto.search = search;
    }
    const building = String(query.building ?? '').trim();
    if (building && !/^all(\s+buildings)?$/i.test(building)) {
      dto.building = building;
    }
    if (query.location_status === 'inside') {
      dto.status = ATTENDANCE_STATUS.present;
    } else if (query.location_status === 'outside') {
      dto.status = ATTENDANCE_STATUS.outsideLocation;
    }

    const [page, catalog] = await Promise.all([
      this.locations.findVisits(dto, actor),
      this.locations.findAll(),
    ]);
    const needle = this.searchNeedle(query);
    const buildingNeedle = building && !/^all(\s+buildings)?$/i.test(building)
      ? building.toLowerCase()
      : '';

    const visits = page.visits.map(
      (row): CampusVoiceVisitRowDto => ({
        student: row.student,
        studentId: row.studentId,
        session: row.session,
        locationName: row.locationName,
        building: row.building,
        room: row.room,
        scannedLocation: row.scannedLocation ?? null,
        recordedAt: row.recordedAt,
        status: row.status,
        distanceMeters: row.distanceMeters ?? null,
      }),
    );
    const zones = catalog
      .filter((row) => {
        if (buildingNeedle && row.building.toLowerCase() !== buildingNeedle) {
          return false;
        }
        if (!needle) {
          return true;
        }
        return this.matchesNeedle(needle, [
          row.name,
          row.building,
          row.room,
          formatCampusLocationLabel(row.building, row.room),
        ]);
      })
      .map(
        (row): CampusVoiceZoneRowDto => ({
          id: row.id,
          name: row.name,
          building: row.building,
          room: row.room,
          radiusMeters: row.radiusMeters,
          status: row.status,
          sessionsUsing: row.sessionsUsing,
        }),
      );

    return summarizeLocations(visits, zones);
  }

  private async loadSessions(
    actor: AuthenticatedUser,
    query: CampusRecordsQueryDto,
  ) {
    const needle = String(query.query ?? query.session_query ?? '')
      .trim()
      .toLowerCase();
    const items = (await this.sessions.findAll(actor))
      .filter((row) => {
        if (!needle) {
          return true;
        }
        return this.matchesNeedle(needle, [
          row.title,
          row.id,
          row.locationName,
          row.teacherName,
        ]);
      })
      .map(
        (row): CampusVoiceSessionRowDto => ({
          id: row.id,
          title: row.title,
          status: row.status,
          locationName: row.locationName,
          teacherName: row.teacherName,
          openedAt: row.openedAt,
          dueAt: row.dueAt,
          closedAt: row.closedAt,
        }),
      );
    return summarizeSessions(items);
  }

  private async loadStudents(query: CampusRecordsQueryDto) {
    const needle = this.searchNeedle(query);
    const items = (await this.students.findAll())
      .filter((row) => {
        if (!needle) {
          return true;
        }
        return this.matchesNeedle(needle, [
          row.name,
          row.studentId,
          row.email,
          row.course,
          row.year,
        ]);
      })
      .map(
        (row): CampusVoiceStudentRowDto => ({
          studentId: row.studentId,
          name: row.name,
          email: row.email,
          course: row.course,
          year: row.year,
          loginEnabled: row.loginEnabled,
          hasAccount: row.hasAccount,
          attendanceRate: row.attendanceRate,
          status: row.status,
        }),
      );
    return summarizeStudents(items);
  }

  private searchNeedle(query: CampusRecordsQueryDto): string {
    return String(query.query ?? '').trim().toLowerCase();
  }

  private matchesNeedle(needle: string, values: Array<string | null | undefined>): boolean {
    return values.some((value) => String(value ?? '').toLowerCase().includes(needle));
  }
}

function isDuePassed(dueAt: string | null | undefined, nowMs: number): boolean {
  if (!dueAt) {
    return false;
  }
  const due = new Date(dueAt).getTime();
  return Number.isFinite(due) && nowMs >= due;
}

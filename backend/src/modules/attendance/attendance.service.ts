import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import {
  FindOptionsWhere,
  In,
  IsNull,
  LessThanOrEqual,
  MoreThan,
  Not,
  Repository,
} from 'typeorm';
import { QR_PAYLOAD_PREFIX } from '../../common/constants/session.constant';
import {
  ADMIN_ATTENDANCE_STATUS_OPTIONS,
  ADMIN_LOCATION_STATUS_OPTIONS,
  ATTENDANCE_LOCATION_STATUS,
  ATTENDANCE_STATUS,
  AttendanceCheckInStatus,
  AttendanceLocationStatus,
} from '../../common/constants/status.constant';
import { USER_ROLES } from '../../common/constants/roles.constant';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { toIsoDate } from '../../common/utils/date.util';
import { ExcelFile } from '../../common/utils/excel.util';
import {
  GeoCoordinates,
  haversineDistanceMeters,
  isWithinRadius,
} from '../../common/utils/geo.util';
import { AttendanceRecordEntity } from '../../database/entities/attendance-record.entity';
import { SessionEntity } from '../../database/entities/session.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { AuthService } from '../auth/auth.service';
import { CampusLocationResponseDto } from '../locations/dto/location-response.dto';
import { LocationsService } from '../locations/locations.service';
import { SessionsService } from '../sessions/sessions.service';
import { buildAttendanceExcel } from './attendance-excel';
import { AdminAttendanceFilterDto } from './dto/admin-attendance-filter.dto';
import {
  AdminAttendanceMetricsDto,
  AdminAttendanceResponseDto,
} from './dto/admin-attendance-response.dto';
import { AttendancePreviewResponseDto } from './dto/attendance-preview-response.dto';
import { AttendanceRecordResponseDto } from './dto/attendance-record-response.dto';
import { SubmitAttendanceDto } from './dto/submit-attendance.dto';
import { ReverseGeocodeService } from './reverse-geocode.service';

interface ParsedPayload {
  sessionId: string;
  token: string;
}

/**
 * Attendance records persisted in MySQL after attendance-token validation.
 */
@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(AttendanceRecordEntity)
    private readonly records: Repository<AttendanceRecordEntity>,
    @InjectRepository(SessionEntity)
    private readonly sessions: Repository<SessionEntity>,
    @InjectRepository(StudentEntity)
    private readonly students: Repository<StudentEntity>,
    private readonly sessionsService: SessionsService,
    private readonly locationsService: LocationsService,
    private readonly authService: AuthService,
    private readonly reverseGeocode: ReverseGeocodeService,
  ) {}

  async preview(
    dto: SubmitAttendanceDto,
    actor: AuthenticatedUser,
  ): Promise<AttendancePreviewResponseDto> {
    const studentId = await this.requireStudentId(actor);
    const { sessionId, token } = this.parsePayload(dto.payload);
    const session = await this.sessionsService.resolveOpenSessionForScan(
      sessionId,
      token,
    );

    return {
      sessionId: session.id,
      title: session.title,
      locationName: session.locationName,
      dueAt: session.dueAt ? toIsoDate(session.dueAt) : null,
      alreadySubmitted: Boolean(
        await this.findByStudentAndSession(studentId, session.id),
      ),
    };
  }

  async submit(
    dto: SubmitAttendanceDto,
    actor: AuthenticatedUser,
    /** Injectable clock for unit tests; defaults to real time. */
    now: Date = new Date(),
  ): Promise<AttendanceRecordResponseDto> {
    const profile = await this.authService.findUserById(actor.userId);
    if (!profile) {
      throw new UnauthorizedException('Student profile not found');
    }

    const studentId = await this.requireStudentId(actor);

    const { sessionId, token } = this.parsePayload(dto.payload);
    const session = await this.sessionsService.resolveOpenSessionForScan(
      sessionId,
      token,
      now,
    );

    if (await this.findByStudentAndSession(studentId, session.id)) {
      throw new ConflictException(
        'You already submitted attendance for this session.',
      );
    }

    // Due-time gate lives in resolveOpenSessionForScan. Location is mandatory
    // (FR-02, hard block): no GPS fix ⇒ no record at all, so a denied/missing
    // permission can never be silently recorded as Present.
    this.requireCoordinates(dto);
    const { status, distanceMeters } = this.evaluateGeofence(
      dto,
      await this.locationsService.findOne(session.locationId),
    );

    const record = this.records.create({
      id: this.nextRecordId(),
      userId: actor.userId,
      student: profile.name,
      studentId,
      sessionId: session.id,
      session: session.title,
      location: session.locationName,
      recordedAt: now,
      status,
      attendanceStatus: ATTENDANCE_STATUS.present,
      distanceMeters,
      latitude: dto.latitude as number,
      longitude: dto.longitude as number,
      scannedLocation: null,
      accuracyMeters: dto.accuracyMeters ?? null,
    });

    try {
      await this.records.save(record);
      await this.attachScannedLocation(record, dto);
    } catch (error) {
      // Race: unique (student_id, session_id) constraint
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException(
          'You already submitted attendance for this session.',
        );
      }
      throw error;
    }

    return this.toResponse(record);
  }

  /**
   * Student “My attendance” history.
   * Only returns rows whose session still exists. Also purges orphan rows left
   * when a teacher deleted a session (cascade + self-heal for older data).
   */
  async findMine(
    actor: AuthenticatedUser,
  ): Promise<AttendanceRecordResponseDto[]> {
    const rows = await this.records.find({
      where: { userId: actor.userId },
      order: { recordedAt: 'DESC' },
    });
    const scans = rows.filter(
      (row) => this.toAttendanceStatus(row) !== ATTENDANCE_STATUS.absent,
    );

    if (scans.length === 0) {
      return [];
    }

    const sessionIds = [...new Set(scans.map((row) => row.sessionId))];
    const existing = await this.sessions.find({
      where: { id: In(sessionIds) },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((session) => session.id));

    const orphans = scans.filter((row) => !existingIds.has(row.sessionId));
    if (orphans.length > 0) {
      await this.records.delete(orphans.map((row) => row.id));
    }

    return scans
      .filter((row) => existingIds.has(row.sessionId))
      .map((row) => this.toResponse(row));
  }

  /**
   * Admin/teacher attendance log with server-side filtering.
   * Date ranges are resolved in server-local time so "Today" matches the
   * day the records were actually created (no client clock drift).
   * Teachers only see rows belonging to their own sessions.
   */
  async findAdminRecords(
    dto: AdminAttendanceFilterDto,
    actor: AuthenticatedUser,
    now: Date = new Date(),
  ): Promise<AdminAttendanceResponseDto> {
    await this.reconcileAbsents(actor, now);

    const qb = this.records
      .createQueryBuilder('record')
      .orderBy('record.recorded_at', 'DESC');

    if (dto.search?.trim()) {
      const needle = `%${dto.search.trim()}%`;
      qb.andWhere(
        '(record.student LIKE :needle OR record.student_id LIKE :needle)',
        { needle },
      );
    }

    if (dto.sessionId) {
      qb.andWhere('record.session_id = :sessionId', {
        sessionId: dto.sessionId,
      });
    }

    if (dto.status === 'inside') {
      qb.andWhere('record.status = :insideStatus', {
        insideStatus: ATTENDANCE_LOCATION_STATUS.inside,
      });
    } else if (dto.status === 'outside') {
      qb.andWhere('record.status = :outsideStatus', {
        outsideStatus: ATTENDANCE_LOCATION_STATUS.outsideLocation,
      });
    }

    if (dto.attendanceStatus === ATTENDANCE_STATUS.absent) {
      qb.andWhere('record.attendance_status = :checkInStatus', {
        checkInStatus: ATTENDANCE_STATUS.absent,
      });
    } else if (dto.attendanceStatus === ATTENDANCE_STATUS.present) {
      qb.andWhere('record.attendance_status = :checkInStatus', {
        checkInStatus: ATTENDANCE_STATUS.present,
      });
    }

    if (dto.date) {
      const { start, end } = this.dateRangeFor(dto.date);
      qb.andWhere('record.recorded_at >= :rangeStart', { rangeStart: start });
      qb.andWhere('record.recorded_at < :rangeEnd', { rangeEnd: end });
    }

    if (actor.role === USER_ROLES.teacher) {
      qb.innerJoin(
        SessionEntity,
        'session',
        'session.id = record.session_id',
      ).andWhere('session.teacher_id = :teacherId', {
        teacherId: actor.userId,
      });
    }

    const rows = await qb.getMany();

    return {
      records: rows.map((row) => this.toResponse(row)),
      metrics: this.buildAdminMetrics(rows),
      statusOptions: ADMIN_LOCATION_STATUS_OPTIONS,
      attendanceStatusOptions: ADMIN_ATTENDANCE_STATUS_OPTIONS,
    };
  }

  /**
   * Same filters and role scope as `findAdminRecords`, returned as an .xlsx
   * workbook (full scanned-at text, Unicode-safe).
   */
  async exportAdminExcel(
    dto: AdminAttendanceFilterDto,
    actor: AuthenticatedUser,
    now: Date = new Date(),
  ): Promise<ExcelFile> {
    const page = await this.findAdminRecords(dto, actor, now);
    return buildAttendanceExcel(page, dto, now);
  }

  /**
   * Persist Absent rows only after the session due time.
   * Until dueAt, Attendance lists scanners only — never the full student roster.
   * Close does not write absents early. Premature Absent rows (from an earlier
   * load while due was already treated as past) are removed if due is still ahead.
   */
  async reconcileAbsents(
    actor: AuthenticatedUser,
    now: Date = new Date(),
  ): Promise<void> {
    const roleScope: FindOptionsWhere<SessionEntity> =
      actor.role === USER_ROLES.teacher ? { teacherId: actor.userId } : {};
    const candidates = await this.sessions.find({
      where: [
        {
          ...roleScope,
          dueAt: LessThanOrEqual(now),
          absentsFinalized: false,
        },
        {
          ...roleScope,
          dueAt: MoreThan(now),
          absentsFinalized: true,
        },
        { ...roleScope, dueAt: IsNull(), absentsFinalized: true },
      ],
    });

    const pendingDue = candidates.filter(
      (session) => this.isDuePassed(session, now) && !session.absentsFinalized,
    );
    const premature = candidates.filter(
      (session) => !this.isDuePassed(session, now) && session.absentsFinalized,
    );

    // This repairs only legacy/inconsistent rows. Ordinary future sessions
    // never trigger a DELETE on page reads.
    await Promise.all(
      premature.map((session) => this.clearPrematureAbsents(session)),
    );

    if (pendingDue.length === 0) {
      return;
    }

    const sessionIds = pendingDue.map((session) => session.id);
    const [roster, existingRows] = await Promise.all([
      this.students.find({
        where: { userId: Not(IsNull()) },
        select: { studentId: true, name: true, userId: true },
      }),
      this.records.find({
        where: { sessionId: In(sessionIds) },
        select: { sessionId: true, studentId: true },
      }),
    ]);

    const recordedBySession = new Map<string, Set<string>>();
    for (const row of existingRows) {
      let ids = recordedBySession.get(row.sessionId);
      if (!ids) {
        ids = new Set<string>();
        recordedBySession.set(row.sessionId, ids);
      }
      ids.add(row.studentId);
    }

    const missingRecords: AttendanceRecordEntity[] = [];
    const insertBatch = async (): Promise<void> => {
      if (missingRecords.length === 0) {
        return;
      }
      const batch = missingRecords.splice(0, missingRecords.length);
      await this.records
        .createQueryBuilder()
        .insert()
        .into(AttendanceRecordEntity)
        .values(batch)
        .orIgnore()
        .execute();
    };

    for (const session of pendingDue) {
      const recordedIds =
        recordedBySession.get(session.id) ?? new Set<string>();
      const recordedAt = session.dueAt ?? session.closedAt ?? now;
      for (const student of roster) {
        if (!student.userId || recordedIds.has(student.studentId)) {
          continue;
        }
        missingRecords.push(
          this.records.create({
            id: this.nextRecordId(),
            userId: student.userId,
            student: student.name,
            studentId: student.studentId,
            sessionId: session.id,
            session: session.title,
            location: session.locationName,
            recordedAt,
            status: null,
            attendanceStatus: ATTENDANCE_STATUS.absent,
            distanceMeters: null,
            latitude: null,
            longitude: null,
            scannedLocation: null,
            accuracyMeters: null,
          }),
        );
        if (missingRecords.length >= 400) {
          await insertBatch();
        }
      }
    }

    // Batch writes instead of a database round trip for every absent student.
    // INSERT IGNORE makes concurrent read requests idempotent under the unique
    // (student_id, session_id) constraint. Keep at most 400 entities in memory
    // while rebuilding many overdue sessions.
    await insertBatch();
    await this.sessions.update(
      { id: In(sessionIds) },
      { absentsFinalized: true },
    );
  }

  /** Same gate as student scan: no dueAt means the window is still open. */
  private isDuePassed(session: SessionEntity, now: Date): boolean {
    if (!session.dueAt) {
      return false;
    }
    return now.getTime() >= new Date(session.dueAt).getTime();
  }

  private async clearPrematureAbsents(session: SessionEntity): Promise<void> {
    await this.records.delete({
      sessionId: session.id,
      attendanceStatus: ATTENDANCE_STATUS.absent,
    });
    session.absentsFinalized = false;
    await this.sessions.save(session);
  }

  /**
   * Local-day boundaries for the "Today / Yesterday / This week" filters.
   * Week starts on Monday so the label matches the UI option.
   */
  private dateRangeFor(
    date: 'today' | 'yesterday' | 'week',
    now: Date = new Date(),
  ): { start: Date; end: Date } {
    const dayMs = 24 * 60 * 60 * 1000;
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    if (date === 'today') {
      return { start: todayStart, end: new Date(todayStart.getTime() + dayMs) };
    }

    if (date === 'yesterday') {
      const yesterdayStart = new Date(todayStart.getTime() - dayMs);
      return { start: yesterdayStart, end: todayStart };
    }

    // This week: Monday 00:00 → next Monday 00:00.
    const daysSinceMonday = (todayStart.getDay() + 6) % 7;
    const weekStart = new Date(todayStart.getTime() - daysSinceMonday * dayMs);
    return { start: weekStart, end: new Date(weekStart.getTime() + 7 * dayMs) };
  }

  private buildAdminMetrics(
    rows: AttendanceRecordEntity[],
  ): AdminAttendanceMetricsDto {
    return {
      present: rows.filter(
        (row) => this.toAttendanceStatus(row) === ATTENDANCE_STATUS.present,
      ).length,
      // Kept for response compatibility; attendance is intentionally only
      // Present / Absent in the separated model.
      late: 0,
      absent: rows.filter(
        (row) => this.toAttendanceStatus(row) === ATTENDANCE_STATUS.absent,
      ).length,
      outsideLocation: rows.filter(
        (row) =>
          this.toLocationStatus(row.status) ===
          ATTENDANCE_LOCATION_STATUS.outsideLocation,
      ).length,
    };
  }

  /**
   * FR-02 hard location gate: a device GPS fix is mandatory to submit.
   * Denied/unsupported/timed-out geolocation on the client means the
   * request simply omits latitude/longitude — reject it here rather than
   * silently recording Present, so attendance always reflects a real fix.
   */
  private requireCoordinates(dto: SubmitAttendanceDto): void {
    if (dto.latitude === undefined || dto.longitude === undefined) {
      throw new BadRequestException(
        'Location access is required to mark attendance. Please allow location and try again.',
      );
    }
  }

  /**
   * FR-02 geofence check: compare the student's device coordinates against
   * the session's location radius via the Haversine formula. Coordinates
   * are guaranteed present here — `requireCoordinates` runs first.
   *
   * - Within `radiusMeters` → Inside.
   * - Outside `radiusMeters` → Outside Location (still recorded — visible to
   *   admins/teachers on the attendance log — not rejected).
   */
  private evaluateGeofence(
    dto: SubmitAttendanceDto,
    location: CampusLocationResponseDto,
  ): { status: AttendanceLocationStatus; distanceMeters: number } {
    const studentPoint: GeoCoordinates = {
      latitude: dto.latitude as number,
      longitude: dto.longitude as number,
    };
    const locationPoint: GeoCoordinates = {
      latitude: location.latitude,
      longitude: location.longitude,
    };

    const distanceMeters = Math.round(
      haversineDistanceMeters(studentPoint, locationPoint),
    );
    const withinRadius = isWithinRadius(
      studentPoint,
      locationPoint,
      location.radiusMeters,
    );

    return {
      status: withinRadius
        ? ATTENDANCE_LOCATION_STATUS.inside
        : ATTENDANCE_LOCATION_STATUS.outsideLocation,
      distanceMeters,
    };
  }

  parsePayload(raw: string): ParsedPayload {
    const parts = raw.trim().split('|');
    if (parts.length !== 3) {
      throw new BadRequestException(
        'Invalid session code. Use the full SMARTCAMPUS|sessionId|token payload from your teacher.',
      );
    }

    const [prefix, sessionId, token] = parts.map((part) => part.trim());
    if (prefix !== QR_PAYLOAD_PREFIX || !sessionId || !token) {
      throw new BadRequestException(
        'Invalid session code. Use the full SMARTCAMPUS|sessionId|token payload from your teacher.',
      );
    }

    return { sessionId, token };
  }

  private async requireStudentId(actor: AuthenticatedUser): Promise<string> {
    const profile = await this.authService.findUserById(actor.userId);
    if (!profile) {
      throw new UnauthorizedException('Student profile not found');
    }
    const studentId = profile.studentId?.trim();
    if (!studentId) {
      throw new BadRequestException(
        'This account has no student ID and cannot submit attendance.',
      );
    }
    return studentId;
  }

  /**
   * Name lookup must not block the scan. Wait up to 2s for a single
   * Nominatim call; if it is still running, save the campus zone name
   * and patch `scannedLocation` when the street name arrives.
   */
  private async attachScannedLocation(
    record: AttendanceRecordEntity,
    dto: SubmitAttendanceDto,
  ): Promise<void> {
    const lookup = this.reverseGeocode.lookup(
      dto.latitude as number,
      dto.longitude as number,
      dto.accuracyMeters,
    );

    const scannedLocation = await withTimeout(lookup, 2_000);
    const resolved = scannedLocation ?? record.location?.trim() ?? null;

    if (resolved) {
      record.scannedLocation = resolved;
      await this.records.save(record);
    }

    if (scannedLocation) {
      return;
    }

    void lookup
      .then(async (lateName) => {
        if (!lateName) {
          return;
        }
        await this.records.update(
          { id: record.id },
          { scannedLocation: lateName },
        );
      })
      .catch(() => undefined);
  }

  private async findByStudentAndSession(
    studentId: string,
    sessionId: string,
  ): Promise<AttendanceRecordEntity | null> {
    return this.records.findOne({ where: { studentId, sessionId } });
  }

  private toResponse(
    record: AttendanceRecordEntity,
  ): AttendanceRecordResponseDto {
    const iso = toIsoDate(record.recordedAt);
    return {
      id: record.id,
      student: record.student,
      studentId: record.studentId,
      sessionId: record.sessionId,
      session: record.session,
      location: record.location,
      recordedAt: iso,
      submittedAt: iso,
      status: this.toLocationStatus(record.status),
      attendanceStatus: this.toAttendanceStatus(record),
      distanceMeters: record.distanceMeters,
      latitude: record.latitude ?? null,
      longitude: record.longitude ?? null,
      scannedLocation: record.scannedLocation ?? null,
      accuracyMeters: record.accuracyMeters ?? null,
    };
  }

  private toAttendanceStatus(
    record: Pick<AttendanceRecordEntity, 'status' | 'attendanceStatus'>,
  ): AttendanceCheckInStatus {
    if (record.attendanceStatus === ATTENDANCE_STATUS.present) {
      return ATTENDANCE_STATUS.present;
    }
    if (record.attendanceStatus === ATTENDANCE_STATUS.absent) {
      return ATTENDANCE_STATUS.absent;
    }

    // Compatibility for rows written before attendance_status existed.
    const legacyStatus = record.status as string | null;
    return legacyStatus === 'Absent' || legacyStatus == null
      ? ATTENDANCE_STATUS.absent
      : ATTENDANCE_STATUS.present;
  }

  private toLocationStatus(
    status: AttendanceRecordEntity['status'],
  ): AttendanceLocationStatus | null {
    switch (status as string | null) {
      case ATTENDANCE_LOCATION_STATUS.inside:
      case 'Present':
        // `Present` was the old persisted value for an inside scan.
        return ATTENDANCE_LOCATION_STATUS.inside;
      case ATTENDANCE_LOCATION_STATUS.outsideLocation:
        return ATTENDANCE_LOCATION_STATUS.outsideLocation;
      default:
        return null;
    }
  }

  private nextRecordId(): string {
    return `att-${randomBytes(6).toString('hex')}`;
  }

  private isDuplicateKeyError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }
    const code = (error as { code?: string }).code;
    const message = String((error as { message?: string }).message ?? '');
    return (
      code === 'ER_DUP_ENTRY' ||
      message.includes('Duplicate entry') ||
      message.includes('UQ_attendance_student_session')
    );
  }
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

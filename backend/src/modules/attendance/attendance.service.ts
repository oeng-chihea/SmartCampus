import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { In, Repository } from 'typeorm';
import { QR_PAYLOAD_PREFIX } from '../../common/constants/session.constant';
import {
  ATTENDANCE_STATUS,
  AttendanceStatus,
} from '../../common/constants/status.constant';
import { USER_ROLES } from '../../common/constants/roles.constant';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { toIsoDate } from '../../common/utils/date.util';
import {
  GeoCoordinates,
  haversineDistanceMeters,
  isWithinRadius,
} from '../../common/utils/geo.util';
import { AttendanceRecordEntity } from '../../database/entities/attendance-record.entity';
import { SessionEntity } from '../../database/entities/session.entity';
import { AuthService } from '../auth/auth.service';
import { CampusLocationResponseDto } from '../locations/dto/location-response.dto';
import { LocationsService } from '../locations/locations.service';
import { SessionsService } from '../sessions/sessions.service';
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
 * Attendance records persisted in MySQL after QR validation.
 */
@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(AttendanceRecordEntity)
    private readonly records: Repository<AttendanceRecordEntity>,
    @InjectRepository(SessionEntity)
    private readonly sessions: Repository<SessionEntity>,
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
    const scannedLocation = await this.reverseGeocode.lookup(
      dto.latitude as number,
      dto.longitude as number,
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
      distanceMeters,
      latitude: dto.latitude as number,
      longitude: dto.longitude as number,
      scannedLocation,
    });

    try {
      await this.records.save(record);
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

    if (rows.length === 0) {
      return [];
    }

    const sessionIds = [...new Set(rows.map((row) => row.sessionId))];
    const existing = await this.sessions.find({
      where: { id: In(sessionIds) },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((session) => session.id));

    const orphans = rows.filter((row) => !existingIds.has(row.sessionId));
    if (orphans.length > 0) {
      await this.records.delete(orphans.map((row) => row.id));
    }

    return rows
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
  ): Promise<AdminAttendanceResponseDto> {
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

    if (dto.status) {
      qb.andWhere('record.status = :status', { status: dto.status });
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
      statusOptions: this.uniqueStatuses(rows),
    };
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

  private buildAdminMetrics(rows: AttendanceRecordEntity[]): AdminAttendanceMetricsDto {
    return {
      present: this.countStatus(rows, ATTENDANCE_STATUS.present),
      late: this.countStatus(rows, ATTENDANCE_STATUS.late),
      absent: this.countStatus(rows, ATTENDANCE_STATUS.absent),
    };
  }

  private countStatus(
    rows: AttendanceRecordEntity[],
    status: AttendanceStatus,
  ): number {
    return rows.reduce((total, row) => total + (row.status === status ? 1 : 0), 0);
  }

  /** Real statuses in stable canonical order (Present, Late, Absent, Outside Location). */
  private uniqueStatuses(rows: AttendanceRecordEntity[]): AttendanceStatus[] {
    const present = new Set(rows.map((row) => row.status as AttendanceStatus));
    return (Object.values(ATTENDANCE_STATUS) as AttendanceStatus[]).filter(
      (status) => present.has(status),
    );
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
   * - Within `radiusMeters` → Present.
   * - Outside `radiusMeters` → Outside Location (still recorded — visible to
   *   admins/teachers on the attendance log — not rejected).
   */
  private evaluateGeofence(
    dto: SubmitAttendanceDto,
    location: CampusLocationResponseDto,
  ): { status: AttendanceStatus; distanceMeters: number } {
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
        ? ATTENDANCE_STATUS.present
        : ATTENDANCE_STATUS.outsideLocation,
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
      session: record.session,
      location: record.location,
      recordedAt: iso,
      submittedAt: iso,
      status: record.status as AttendanceStatus,
      distanceMeters: record.distanceMeters,
      latitude: record.latitude ?? null,
      longitude: record.longitude ?? null,
      scannedLocation: record.scannedLocation ?? null,
    };
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

import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { QR_PAYLOAD_PREFIX } from '../../common/constants/session.constant';
import {
  ATTENDANCE_STATUS,
  AttendanceStatus,
} from '../../common/constants/status.constant';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { toIsoDate } from '../../common/utils/date.util';
import { AttendanceRecordEntity } from '../../database/entities/attendance-record.entity';
import { AuthService } from '../auth/auth.service';
import { SessionsService } from '../sessions/sessions.service';
import { AttendancePreviewResponseDto } from './dto/attendance-preview-response.dto';
import { AttendanceRecordResponseDto } from './dto/attendance-record-response.dto';
import { SubmitAttendanceDto } from './dto/submit-attendance.dto';

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
    private readonly sessionsService: SessionsService,
    private readonly authService: AuthService,
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
      lateAfterMinutes: session.lateAfterMinutes,
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
    );

    if (await this.findByStudentAndSession(studentId, session.id)) {
      throw new ConflictException(
        'You already submitted attendance for this session.',
      );
    }

    const status = this.resolveStatus(
      session.openedAt,
      session.lateAfterMinutes,
      now,
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
      distanceMeters: null,
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

  async findMine(
    actor: AuthenticatedUser,
  ): Promise<AttendanceRecordResponseDto[]> {
    const rows = await this.records.find({
      where: { userId: actor.userId },
      order: { recordedAt: 'DESC' },
    });
    return rows.map((row) => this.toResponse(row));
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

  private resolveStatus(
    openedAt: Date,
    lateAfterMinutes: number,
    now: Date,
  ): AttendanceStatus {
    const deadlineMs = openedAt.getTime() + lateAfterMinutes * 60 * 1000;
    return now.getTime() <= deadlineMs
      ? ATTENDANCE_STATUS.present
      : ATTENDANCE_STATUS.late;
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

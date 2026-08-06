import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import {
  DEFAULT_LATE_AFTER_MINUTES,
  QR_PAYLOAD_PREFIX,
  QR_TTL_SECONDS,
  SESSION_STATUS,
  type SessionStatus,
} from '../../common/constants/session.constant';
import { USER_ROLES } from '../../common/constants/roles.constant';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { toIsoDate } from '../../common/utils/date.util';
import { SessionEntity } from '../../database/entities/session.entity';
import { AuthService } from '../auth/auth.service';
import { LocationsService } from '../locations/locations.service';
import { CreateSessionDto } from './dto/create-session.dto';
import {
  OpenSessionLiveDto,
  QrResponseDto,
  SessionQrSnapshot,
  SessionResponseDto,
  SessionScanContext,
} from './dto/session-response.dto';

/**
 * Attendance sessions and short-lived QR tokens — persisted in MySQL.
 */
@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(SessionEntity)
    private readonly sessions: Repository<SessionEntity>,
    private readonly locationsService: LocationsService,
    private readonly authService: AuthService,
  ) {}

  async create(
    dto: CreateSessionDto,
    actor: AuthenticatedUser,
  ): Promise<SessionResponseDto> {
    const location = await this.locationsService.findActiveById(dto.locationId);
    const teacher = await this.authService.findUserById(actor.userId);
    const teacherName = teacher?.name ?? 'Unknown teacher';

    const now = new Date();
    const qr = this.issueQrToken(now);
    const session = this.sessions.create({
      id: this.nextSessionId(),
      title: dto.title.trim(),
      locationId: location.id,
      locationName: location.name,
      teacherId: actor.userId,
      teacherName,
      status: SESSION_STATUS.open,
      lateAfterMinutes: dto.lateAfterMinutes ?? DEFAULT_LATE_AFTER_MINUTES,
      createdAt: now,
      openedAt: now,
      closedAt: null,
      qrToken: qr.token,
      qrIssuedAt: qr.issuedAt,
      qrExpiresAt: qr.expiresAt,
    });

    await this.sessions.save(session);
    await this.locationsService.incrementSessionsUsing(location.id);

    return this.toResponse(session, actor, true);
  }

  async findAll(actor: AuthenticatedUser): Promise<SessionResponseDto[]> {
    const rows = await this.sessions.find({
      order: { openedAt: 'DESC' },
    });

    const visible =
      actor.role === USER_ROLES.admin
        ? rows
        : rows.filter((session) => session.teacherId === actor.userId);

    return visible.map((session) => this.toResponse(session, actor, false));
  }

  /**
   * Live open sessions for teacher + student UIs.
   * Rotates expired QR tokens so both sides share the same current code.
   */
  async listOpenLive(): Promise<OpenSessionLiveDto[]> {
    const rows = await this.sessions.find({
      where: { status: SESSION_STATUS.open },
      order: { openedAt: 'DESC' },
    });

    const live: OpenSessionLiveDto[] = [];
    for (const session of rows) {
      live.push(await this.toOpenLive(session));
    }
    return live;
  }

  async findOne(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<SessionResponseDto> {
    const session = await this.requireSession(id);
    this.assertCanAccess(session, actor);
    return this.toResponse(session, actor, true);
  }

  /**
   * Returns the current short-lived QR for an open session.
   * Rotates automatically when the previous token has expired.
   */
  async getQr(id: string, actor: AuthenticatedUser): Promise<QrResponseDto> {
    const session = await this.requireSession(id);
    this.assertCanManage(session, actor);

    if (session.status !== SESSION_STATUS.open) {
      throw new ForbiddenException(
        'Cannot issue a QR code for a closed session',
      );
    }

    await this.ensureFreshQr(session);
    return this.toQrResponse(session);
  }

  async close(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<SessionResponseDto> {
    const session = await this.requireSession(id);
    this.assertCanManage(session, actor);

    if (session.status === SESSION_STATUS.closed) {
      return this.toResponse(session, actor, false);
    }

    session.status = SESSION_STATUS.closed;
    session.closedAt = new Date();
    session.qrToken = null;
    session.qrIssuedAt = null;
    session.qrExpiresAt = null;
    await this.sessions.save(session);
    await this.locationsService.decrementSessionsUsing(session.locationId);

    return this.toResponse(session, actor, false);
  }

  /**
   * Validate a student scan against an open session's current QR.
   * Used by AttendanceService only — no teacher ownership check.
   */
  async resolveOpenSessionForScan(
    sessionId: string,
    token: string,
  ): Promise<SessionScanContext> {
    const session = await this.requireSession(sessionId);

    if (session.status !== SESSION_STATUS.open) {
      throw new ForbiddenException(
        'This session is closed. Attendance is no longer accepted.',
      );
    }

    if (
      !session.qrToken ||
      this.isQrExpired(session) ||
      session.qrToken !== token
    ) {
      throw new ForbiddenException(
        'QR code is invalid or expired. Ask your teacher to refresh the QR.',
      );
    }

    return {
      id: session.id,
      title: session.title,
      locationName: session.locationName,
      openedAt: session.openedAt,
      lateAfterMinutes: session.lateAfterMinutes,
    };
  }

  private async requireSession(id: string): Promise<SessionEntity> {
    const session = await this.sessions.findOne({ where: { id } });
    if (!session) {
      throw new NotFoundException(`Session ${id} not found`);
    }
    return session;
  }

  private assertCanAccess(
    session: SessionEntity,
    actor: AuthenticatedUser,
  ): void {
    if (actor.role === USER_ROLES.admin || session.teacherId === actor.userId) {
      return;
    }
    throw new ForbiddenException('You cannot access this session');
  }

  private assertCanManage(
    session: SessionEntity,
    actor: AuthenticatedUser,
  ): void {
    if (actor.role === USER_ROLES.admin || session.teacherId === actor.userId) {
      return;
    }
    throw new ForbiddenException('You cannot manage this session');
  }

  private issueQrToken(issuedAt: Date = new Date()): {
    token: string;
    issuedAt: Date;
    expiresAt: Date;
  } {
    return {
      token: randomBytes(16).toString('hex'),
      issuedAt,
      expiresAt: new Date(issuedAt.getTime() + QR_TTL_SECONDS * 1000),
    };
  }

  private async ensureFreshQr(session: SessionEntity): Promise<void> {
    if (!session.qrToken || this.isQrExpired(session)) {
      const qr = this.issueQrToken();
      session.qrToken = qr.token;
      session.qrIssuedAt = qr.issuedAt;
      session.qrExpiresAt = qr.expiresAt;
      await this.sessions.save(session);
    }
  }

  private isQrExpired(session: SessionEntity, now: Date = new Date()): boolean {
    if (!session.qrExpiresAt) {
      return true;
    }
    return now.getTime() >= session.qrExpiresAt.getTime();
  }

  private toQrResponse(session: SessionEntity): QrResponseDto {
    return {
      sessionId: session.id,
      token: session.qrToken as string,
      issuedAt: toIsoDate(session.qrIssuedAt as Date),
      expiresAt: toIsoDate(session.qrExpiresAt as Date),
      ttlSeconds: QR_TTL_SECONDS,
      payload: `${QR_PAYLOAD_PREFIX}|${session.id}|${session.qrToken}`,
    };
  }

  private async toOpenLive(
    session: SessionEntity,
  ): Promise<OpenSessionLiveDto> {
    await this.ensureFreshQr(session);
    return {
      id: session.id,
      title: session.title,
      locationName: session.locationName,
      teacherName: session.teacherName,
      lateAfterMinutes: session.lateAfterMinutes,
      openedAt: toIsoDate(session.openedAt),
      qr: this.toQrResponse(session),
    };
  }

  private toResponse(
    session: SessionEntity,
    actor: AuthenticatedUser,
    includeQr: boolean,
  ): SessionResponseDto {
    const canSeeQr =
      includeQr &&
      session.status === SESSION_STATUS.open &&
      (actor.role === USER_ROLES.admin || session.teacherId === actor.userId);

    let currentQr: SessionQrSnapshot | null | undefined;
    if (
      canSeeQr &&
      session.qrToken &&
      session.qrIssuedAt &&
      session.qrExpiresAt &&
      !this.isQrExpired(session)
    ) {
      currentQr = {
        token: session.qrToken,
        issuedAt: toIsoDate(session.qrIssuedAt),
        expiresAt: toIsoDate(session.qrExpiresAt),
      };
    } else if (canSeeQr) {
      currentQr = null;
    }

    return {
      id: session.id,
      title: session.title,
      locationId: session.locationId,
      locationName: session.locationName,
      teacherId: session.teacherId,
      teacherName: session.teacherName,
      status: session.status as SessionStatus,
      lateAfterMinutes: session.lateAfterMinutes,
      createdAt: toIsoDate(session.createdAt),
      openedAt: toIsoDate(session.openedAt),
      closedAt: session.closedAt ? toIsoDate(session.closedAt) : null,
      ...(canSeeQr ? { currentQr } : {}),
    };
  }

  private nextSessionId(): string {
    return `sess-${randomBytes(6).toString('hex')}`;
  }
}

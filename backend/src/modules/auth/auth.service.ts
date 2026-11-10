import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { MoreThan, Repository } from 'typeorm';
import { USER_ROLES, UserRole } from '../../common/constants/roles.constant';
import { verifyPassword } from '../../common/utils/password.util';
import { PasswordResetTokenEntity } from '../../database/entities/password-reset-token.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { MailService } from '../mail/mail.service';
import { StudentsService } from '../students/students.service';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { UsersService } from '../users/users.service';
import { AuthSessionResponseDto } from './dto/auth-session-response.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

const RESET_TTL_MS = 30 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

export interface TokenPayload {
  sub: string;
  role: UserRole;
  iat?: number;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}


@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly tokenSecret: string;
  private readonly resetBaseUrl: string;

  constructor(
    private readonly usersService: UsersService,
    private readonly studentsService: StudentsService,
    private readonly configService: ConfigService,
    @InjectRepository(PasswordResetTokenEntity)
    private readonly resetTokens: Repository<PasswordResetTokenEntity>,
    private readonly mail: MailService,
  ) {
    this.resetBaseUrl =
      this.configService.get<string>('mail.resetBaseUrl') ??
      'https://localhost:4200';
    this.tokenSecret =
      this.configService.get<string>('jwt.secret') ??
      process.env.JWT_SECRET ??
      'smartcampus-demo-secret';
  }

  async login(dto: LoginDto): Promise<AuthSessionResponseDto> {
    const email = (dto.email ?? '').trim().toLowerCase();
    const user = await this.usersService.findByEmail(email);

    if (!user || !verifyPassword(dto.password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.role === USER_ROLES.student) {
      await this.assertStudentLoginEnabled(user.studentId);
    }

    const profile = this.usersService.toResponse(user);
    const accessToken = this.signToken(profile.id, profile.role);

    return {
      accessToken,
      user: profile,
    };
  }

  async requestPasswordReset({ email }: ForgotPasswordDto): Promise<void> {
    const user = await this.findResettableStudent(email);
    if (!user || (await this.isInCooldown(user.id))) {
      return;
    }

    const token = randomBytes(32).toString('base64url');

    await this.resetTokens.delete({ userId: user.id });
    await this.resetTokens.save({
      userId: user.id,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
    });

    const link = `${this.resetBaseUrl}/auth/reset-password#token=${token}`;

    void this.mail
      .sendPasswordReset(user.email, user.name, link)
      .catch((error) => this.logger.error('Reset email failed', error));
  }

  async resetPassword({ token, password }: ResetPasswordDto): Promise<void> {
    const row = await this.resetTokens.findOne({
      where: { tokenHash: sha256(token), expiresAt: MoreThan(new Date()) },
    });
    const claimed =
      row && (await this.resetTokens.delete({ id: row.id })).affected;

    if (!row || !claimed) {
      throw new BadRequestException(
        'This reset link is invalid or has expired. Request a new one.',
      );
    }

    await this.usersService.updatePassword(row.userId, password);
  }

  async authenticate(token: string): Promise<TokenPayload | null> {
    const payload = this.verifyToken(token);
    if (!payload?.iat) {
      return null;
    }

    const user = await this.usersService.findById(payload.sub);
    const changedAt = user?.passwordChangedAt?.getTime() ?? 0;

    return user && payload.iat >= changedAt ? payload : null;
  }

  private async findResettableStudent(
    email: string,
  ): Promise<UserEntity | null> {
    const user = await this.usersService.findByEmail(email);
    if (user?.role !== USER_ROLES.student || !user.studentId) {
      return null;
    }

    const student = await this.studentsService.findByStudentId(user.studentId);
    return student?.loginEnabled ? user : null;
  }

  private async isInCooldown(userId: string): Promise<boolean> {
    const latest = await this.resetTokens.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return (
      !!latest && Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS
    );
  }

  /** Block login when the linked student profile has login access disabled. */
  private async assertStudentLoginEnabled(
    studentId: string | null | undefined,
  ): Promise<void> {
    if (!studentId) {
      return;
    }
    const student = await this.studentsService.findByStudentId(studentId);
    if (student && !student.loginEnabled) {
      throw new ForbiddenException(
        'This student account is disabled. Contact your administrator.',
      );
    }
  }

  private signToken(userId: string, role: UserRole): string {
    const payload = Buffer.from(
      JSON.stringify({
        sub: userId,
        role,
        iat: Date.now(),
        nonce: randomBytes(8).toString('hex'),
      }),
    ).toString('base64url');
    const signature = createHmac('sha256', this.tokenSecret)
      .update(payload)
      .digest('base64url');
    return `${payload}.${signature}`;
  }

  verifyToken(token: string): TokenPayload | null {
    const [payload, signature] = token.split('.');
    if (!payload || !signature) {
      return null;
    }

    const expected = createHmac('sha256', this.tokenSecret)
      .update(payload)
      .digest('base64url');
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      return null;
    }

    try {
      return JSON.parse(
        Buffer.from(payload, 'base64url').toString('utf8'),
      ) as TokenPayload;
    } catch {
      return null;
    }
  }

  /** Resolve a user profile by id (session ownership labels, attendance). */
  async findUserById(userId: string): Promise<UserResponseDto | null> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      return null;
    }
    return this.usersService.toResponse(user);
  }
}

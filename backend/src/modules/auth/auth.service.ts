import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { UserRole } from '../../common/constants/roles.constant';
import { verifyPassword } from '../../common/utils/password.util';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { UsersService } from '../users/users.service';
import { AuthSessionResponseDto } from './dto/auth-session-response.dto';
import { LoginDto } from './dto/login.dto';

/**
 * Auth against MySQL users (hashed passwords).
 * Tokens remain HMAC-signed demo tokens (not production JWT library).
 */
@Injectable()
export class AuthService {
  private readonly tokenSecret: string;

  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {
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

    const profile = this.usersService.toResponse(user);
    const accessToken = this.signToken(profile.id, profile.role);

    return {
      accessToken,
      user: profile,
    };
  }

  private signToken(userId: string, role: UserRole): string {
    const payload = Buffer.from(
      JSON.stringify({
        sub: userId,
        role,
        nonce: randomBytes(8).toString('hex'),
      }),
    ).toString('base64url');
    const signature = createHmac('sha256', this.tokenSecret)
      .update(payload)
      .digest('base64url');
    return `${payload}.${signature}`;
  }

  verifyToken(token: string): { sub: string; role: UserRole } | null {
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
      return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
        sub: string;
        role: UserRole;
      };
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

import {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import { hashPassword } from '../../common/utils/password.util';
import { PasswordResetTokenEntity } from '../../database/entities/password-reset-token.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { MailService } from '../mail/mail.service';
import { StudentsService } from '../students/students.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

function makeUser(
  partial: Partial<UserEntity> &
    Pick<UserEntity, 'id' | 'name' | 'email' | 'role' | 'passwordHash'>,
): UserEntity {
  return {
    studentId: null,
    passwordChangedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  } as UserEntity;
}

describe('AuthService', () => {
  let service: AuthService;
  let users: {
    findByEmail: jest.Mock;
    findById: jest.Mock;
    updatePassword: jest.Mock;
    toResponse: UsersService['toResponse'];
  };
  let resetTokens: {
    findOne: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let mail: { sendPasswordReset: jest.Mock };
  let students: {
    findByStudentId: jest.Mock;
  };

  const teacher = makeUser({
    id: 'u-teacher-1',
    name: 'Teacher Kim',
    email: 'teacher@smartcampus.edu',
    role: 'teacher',
    passwordHash: hashPassword('teacher123'),
  });
  const student = makeUser({
    id: 'u-student-1',
    name: 'Sok Dara',
    email: 'student@smartcampus.edu',
    role: 'student',
    studentId: 'SC-1024',
    passwordHash: hashPassword('student123'),
  });

  const byEmail: Record<string, UserEntity> = {
    [teacher.email]: teacher,
    [student.email]: student,
  };
  const byId: Record<string, UserEntity> = {
    [teacher.id]: teacher,
    [student.id]: student,
  };

  const activeStudentProfile: StudentEntity = {
    studentId: 'SC-1024',
    name: 'Sok Dara',
    email: 'sok.dara@smartcampus.edu',
    course: 'SE401',
    year: 'Year 3',
    attendanceRate: 94,
    status: 'Active',
    loginEnabled: true,
    userId: 'u-student-1',
  };

  beforeEach(() => {
    users = {
      findByEmail: jest.fn(async (email: string) => byEmail[email] ?? null),
      findById: jest.fn(async (id: string) => byId[id] ?? null),
      updatePassword: jest.fn(async () => undefined),
      toResponse: (user: UserEntity) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role as 'teacher' | 'student',
        ...(user.studentId ? { studentId: user.studentId } : {}),
      }),
    };

    students = {
      findByStudentId: jest.fn(async (studentId: string) =>
        studentId === 'SC-1024' ? activeStudentProfile : null,
      ),
    };

    const config = {
      get: jest.fn((key: string) =>
        key === 'jwt.secret' ? 'test-secret' : undefined,
      ),
    } as unknown as ConfigService;

    resetTokens = {
      findOne: jest.fn(async () => null),
      save: jest.fn(async (row: unknown) => row),
      delete: jest.fn(async () => ({ affected: 1 })),
    };
    mail = { sendPasswordReset: jest.fn(async () => undefined) };

    service = new AuthService(
      users as unknown as UsersService,
      students as unknown as StudentsService,
      config,
      resetTokens as unknown as Repository<PasswordResetTokenEntity>,
      mail as unknown as MailService,
    );
  });

  it('normalizes email before matching a user', async () => {
    const session = await service.login({
      email: '  TEACHER@SMARTCAMPUS.EDU ',
      password: 'teacher123',
    });

    expect(session.user).toEqual({
      id: 'u-teacher-1',
      name: 'Teacher Kim',
      email: 'teacher@smartcampus.edu',
      role: 'teacher',
    });
    expect(session.accessToken).toEqual(expect.any(String));
  });

  it('does not include a password in the authenticated user profile', async () => {
    const session = await service.login({
      email: 'student@smartcampus.edu',
      password: 'student123',
    });

    expect(session.user).not.toHaveProperty('password');
    expect(session.user).not.toHaveProperty('passwordHash');
  });

  it('rejects invalid credentials', async () => {
    await expect(
      service.login({
        email: 'teacher@smartcampus.edu',
        password: 'wrong-password',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('blocks login when the student login access is disabled', async () => {
    students.findByStudentId = jest.fn(async () => ({
      ...activeStudentProfile,
      loginEnabled: false,
    }));

    await expect(
      service.login({
        email: 'student@smartcampus.edu',
        password: 'student123',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('verifies a token issued during login', async () => {
    const session = await service.login({
      email: 'teacher@smartcampus.edu',
      password: 'teacher123',
    });

    expect(service.verifyToken(session.accessToken)).toMatchObject({
      sub: 'u-teacher-1',
      role: 'teacher',
    });
  });

  it.each(['', 'not-a-token', 'payload.invalid-signature'])(
    'rejects malformed token %p',
    (token) => {
      expect(service.verifyToken(token)).toBeNull();
    },
  );

  it('resolves a user profile by id', async () => {
    await expect(service.findUserById('u-teacher-1')).resolves.toMatchObject({
      id: 'u-teacher-1',
      name: 'Teacher Kim',
      role: 'teacher',
    });
    await expect(service.findUserById('missing')).resolves.toBeNull();
  });
  describe('authenticate', () => {
    it('accepts a token issued during login', async () => {
      const { accessToken } = await service.login({
        email: 'teacher@smartcampus.edu',
        password: 'teacher123',
      });

      await expect(service.authenticate(accessToken)).resolves.toMatchObject({
        sub: 'u-teacher-1',
      });
    });

    it('rejects a token issued before the password changed', async () => {
      const { accessToken } = await service.login({
        email: 'student@smartcampus.edu',
        password: 'student123',
      });
      users.findById = jest.fn(async () => ({
        ...student,
        passwordChangedAt: new Date(Date.now() + 1000),
      }));

      await expect(service.authenticate(accessToken)).resolves.toBeNull();
    });

    it('rejects a token whose user no longer exists', async () => {
      const { accessToken } = await service.login({
        email: 'teacher@smartcampus.edu',
        password: 'teacher123',
      });
      users.findById = jest.fn(async () => null);

      await expect(service.authenticate(accessToken)).resolves.toBeNull();
    });
  });

  describe('requestPasswordReset', () => {
    const sentLink = (): string => mail.sendPasswordReset.mock.calls[0][2];

    it('stores only a hash of the emailed token', async () => {
      await service.requestPasswordReset({ email: student.email });

      const token = sentLink().split('#token=')[1];
      const saved = resetTokens.save.mock.calls[0][0];

      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(saved.userId).toBe(student.id);
      expect(saved.tokenHash).toBe(
        createHash('sha256').update(token).digest('hex'),
      );
      expect(saved.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(JSON.stringify(saved)).not.toContain(token);
    });

    it('replaces older links for the same account', async () => {
      await service.requestPasswordReset({ email: student.email });

      expect(resetTokens.delete).toHaveBeenCalledWith({ userId: student.id });
    });

    it.each([
      ['an unknown email', 'nobody@smartcampus.edu'],
      ['a teacher account', teacher.email],
    ])('sends nothing for %s', async (_label, email) => {
      await expect(
        service.requestPasswordReset({ email }),
      ).resolves.toBeUndefined();

      expect(resetTokens.save).not.toHaveBeenCalled();
      expect(mail.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('sends nothing when student login access is disabled', async () => {
      students.findByStudentId = jest.fn(async () => ({
        ...activeStudentProfile,
        loginEnabled: false,
      }));

      await service.requestPasswordReset({ email: student.email });

      expect(mail.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('sends nothing when a link was requested moments ago', async () => {
      resetTokens.findOne = jest.fn(async () => ({ createdAt: new Date() }));

      await service.requestPasswordReset({ email: student.email });

      expect(mail.sendPasswordReset).not.toHaveBeenCalled();
    });

    it('does not fail the request when the email cannot be sent', async () => {
      mail.sendPasswordReset = jest.fn(async () => {
        throw new Error('smtp down');
      });

      await expect(
        service.requestPasswordReset({ email: student.email }),
      ).resolves.toBeUndefined();
    });
  });

  describe('resetPassword', () => {
    const dto = { token: 'a'.repeat(43), password: 'new-password-1' };
    const row = { id: 'row-1', userId: student.id };

    it('updates the password and consumes the token', async () => {
      resetTokens.findOne = jest.fn(async () => row);

      await service.resetPassword(dto);

      expect(resetTokens.delete).toHaveBeenCalledWith({ id: 'row-1' });
      expect(users.updatePassword).toHaveBeenCalledWith(
        student.id,
        'new-password-1',
      );
    });

    it('rejects an unknown or expired token', async () => {
      await expect(service.resetPassword(dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(users.updatePassword).not.toHaveBeenCalled();
    });

    it('rejects a token another request already consumed', async () => {
      resetTokens.findOne = jest.fn(async () => row);
      resetTokens.delete = jest.fn(async () => ({ affected: 0 }));

      await expect(service.resetPassword(dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(users.updatePassword).not.toHaveBeenCalled();
    });
  });
});

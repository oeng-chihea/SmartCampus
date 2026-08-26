import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hashPassword } from '../../common/utils/password.util';
import { StudentEntity } from '../../database/entities/student.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { StudentsService } from '../students/students.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

function makeUser(
  partial: Partial<UserEntity> &
    Pick<UserEntity, 'id' | 'name' | 'email' | 'role' | 'passwordHash'>,
): UserEntity {
  return {
    studentId: null,
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
    toResponse: UsersService['toResponse'];
  };
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
      toResponse: (user: UserEntity) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
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

    service = new AuthService(
      users as unknown as UsersService,
      students as unknown as StudentsService,
      config,
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
});

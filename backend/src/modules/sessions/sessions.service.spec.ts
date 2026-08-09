import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { AttendanceRecordEntity } from '../../database/entities/attendance-record.entity';
import { SessionEntity } from '../../database/entities/session.entity';
import { AuthService } from '../auth/auth.service';
import { LocationsService } from '../locations/locations.service';
import { LOCATION_SEED } from '../locations/data/locations.seed';
import { SessionsService } from './sessions.service';

function dueInMinutes(minutes: number): string {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

describe('SessionsService', () => {
  let service: SessionsService;
  let locationStore: typeof LOCATION_SEED;
  let sessionStore: SessionEntity[];
  let attendanceStore: AttendanceRecordEntity[];
  let attendanceDelete: jest.Mock;

  const teacher = { userId: 'u-teacher-1', role: 'teacher' as const };
  const admin = { userId: 'u-admin-1', role: 'admin' as const };
  const otherTeacher = {
    userId: 'u-teacher-missing',
    role: 'teacher' as const,
  };

  beforeEach(() => {
    locationStore = LOCATION_SEED.map((row) => ({ ...row }));
    sessionStore = [];
    attendanceStore = [];
    attendanceDelete = jest.fn(async (sessionId: string) => {
      const before = attendanceStore.length;
      attendanceStore = attendanceStore.filter(
        (row) => row.sessionId !== sessionId,
      );
      return { affected: before - attendanceStore.length };
    });

    const locations = {
      findActiveById: jest.fn(async (id: string) => {
        const location = locationStore.find((row) => row.id === id);
        if (!location || location.status !== 'Active') {
          throw new NotFoundException(
            `Location ${id} is not Active and cannot host a session`,
          );
        }
        return { ...location };
      }),
      findOne: jest.fn(async (id: string) => {
        const location = locationStore.find((row) => row.id === id);
        if (!location) {
          throw new NotFoundException(`Location ${id} not found`);
        }
        return { ...location };
      }),
      incrementSessionsUsing: jest.fn(async (id: string) => {
        const location = locationStore.find((row) => row.id === id);
        if (location) {
          location.sessionsUsing += 1;
        }
      }),
      decrementSessionsUsing: jest.fn(async (id: string) => {
        const location = locationStore.find((row) => row.id === id);
        if (location && location.sessionsUsing > 0) {
          location.sessionsUsing -= 1;
        }
      }),
    } as unknown as LocationsService;

    const auth = {
      findUserById: jest.fn(async (id: string) => {
        if (id === 'u-teacher-1') {
          return {
            id: 'u-teacher-1',
            name: 'Teacher Kim',
            email: 'teacher@smartcampus.edu',
            role: 'teacher' as const,
          };
        }
        if (id === 'u-admin-1') {
          return {
            id: 'u-admin-1',
            name: 'System Admin',
            email: 'admin@smartcampus.edu',
            role: 'admin' as const,
          };
        }
        return null;
      }),
    } as unknown as AuthService;

    const repo = {
      create: jest.fn((data: Partial<SessionEntity>) =>
        ({ ...data }) as SessionEntity,
      ),
      save: jest.fn(async (entity: SessionEntity) => {
        const index = sessionStore.findIndex((row) => row.id === entity.id);
        if (index >= 0) {
          sessionStore[index] = entity;
        } else {
          sessionStore.push(entity);
        }
        return entity;
      }),
      find: jest.fn(
        async (options?: {
          where?: { status?: string };
          order?: { openedAt?: 'ASC' | 'DESC' };
        }) => {
          let rows = [...sessionStore];
          if (options?.where?.status) {
            rows = rows.filter((row) => row.status === options.where?.status);
          }
          rows.sort(
            (a, b) => b.openedAt.getTime() - a.openedAt.getTime(),
          );
          return rows;
        },
      ),
      findOne: jest.fn(async ({ where }: { where: { id: string } }) =>
        sessionStore.find((row) => row.id === where.id) ?? null,
      ),
      remove: jest.fn(async (entity: SessionEntity) => {
        sessionStore = sessionStore.filter((row) => row.id !== entity.id);
        return entity;
      }),
    } as unknown as Repository<SessionEntity>;

    const attendanceRepo = {
      createQueryBuilder: jest.fn(() => {
        const qb = {
          delete: jest.fn().mockReturnThis(),
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          execute: jest.fn(async () => {
            // Last where call is "session_id = :sessionId"
            const whereMock = qb.where as jest.Mock;
            const lastCall = whereMock.mock.calls[whereMock.mock.calls.length - 1];
            const params = (lastCall?.[1] ?? {}) as { sessionId?: string };
            if (params.sessionId) {
              await attendanceDelete(params.sessionId);
            }
            return { affected: 0 };
          }),
        };
        return qb;
      }),
    } as unknown as Repository<AttendanceRecordEntity>;

    service = new SessionsService(repo, attendanceRepo, locations, auth);
  });

  it('creates an open session on an active location with a QR token and dueAt', async () => {
    const dueAt = dueInMinutes(45);
    const session = await service.create(
      {
        title: 'SE401 · Morning Lecture',
        locationId: 'LOC-001',
        dueAt,
      },
      teacher,
    );

    expect(session.status).toBe('Open');
    expect(session.locationName).toContain('Building A');
    expect(session.teacherName).toBe('Teacher Kim');
    expect(session.dueAt).toBe(new Date(dueAt).toISOString());
    expect(session.currentQr?.token).toEqual(expect.any(String));
    expect(
      locationStore.find((row) => row.id === 'LOC-001')?.sessionsUsing,
    ).toBe(1);
  });

  it('rejects create when dueAt is in the past or too soon', async () => {
    await expect(
      service.create(
        {
          title: 'Too soon',
          locationId: 'LOC-001',
          dueAt: dueInMinutes(0),
        },
        teacher,
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.create(
        {
          title: 'In the past',
          locationId: 'LOC-001',
          dueAt: dueInMinutes(-10),
        },
        teacher,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects sessions on inactive locations', async () => {
    await expect(
      service.create(
        {
          title: 'Blocked session',
          locationId: 'LOC-005',
          dueAt: dueInMinutes(30),
        },
        teacher,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns and rotates QR for open sessions', async () => {
    const created = await service.create(
      {
        title: 'Lab session',
        locationId: 'LOC-002',
        dueAt: dueInMinutes(60),
      },
      teacher,
    );

    const qr = await service.getQr(created.id, teacher);
    expect(qr.sessionId).toBe(created.id);
    expect(qr.ttlSeconds).toBe(300);
    expect(qr.payload).toContain(created.id);
    expect(qr.payload.startsWith('SMARTCAMPUS|')).toBe(true);
  });

  it('closes a session and blocks further QR issuance', async () => {
    const created = await service.create(
      {
        title: 'Closing test',
        locationId: 'LOC-001',
        dueAt: dueInMinutes(30),
      },
      teacher,
    );

    const closed = await service.close(created.id, teacher);
    expect(closed.status).toBe('Closed');
    expect(closed.closedAt).toEqual(expect.any(String));
    expect(
      locationStore.find((row) => row.id === 'LOC-001')?.sessionsUsing,
    ).toBe(0);

    await expect(service.getQr(created.id, teacher)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('deletes a session and removes it from the store', async () => {
    const created = await service.create(
      {
        title: 'Delete me',
        locationId: 'LOC-001',
        dueAt: dueInMinutes(30),
      },
      teacher,
    );
    expect(
      locationStore.find((row) => row.id === 'LOC-001')?.sessionsUsing,
    ).toBe(1);

    await service.remove(created.id, teacher);

    expect(sessionStore.find((row) => row.id === created.id)).toBeUndefined();
    expect(
      locationStore.find((row) => row.id === 'LOC-001')?.sessionsUsing,
    ).toBe(0);
    await expect(service.findOne(created.id, teacher)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('deletes attendance records for the session when the session is removed', async () => {
    const created = await service.create(
      {
        title: 'Cascade delete',
        locationId: 'LOC-001',
        dueAt: dueInMinutes(30),
      },
      teacher,
    );
    attendanceStore.push(
      {
        id: 'att-1',
        userId: 'u-student-1',
        student: 'Chihea',
        studentId: 'SC-1001',
        sessionId: created.id,
        session: created.title,
        location: created.locationName,
        recordedAt: new Date(),
        status: 'Present',
        distanceMeters: null,
      },
      {
        id: 'att-2',
        userId: 'u-student-2',
        student: 'Other',
        studentId: 'SC-1002',
        sessionId: created.id,
        session: created.title,
        location: created.locationName,
        recordedAt: new Date(),
        status: 'Present',
        distanceMeters: null,
      },
      {
        id: 'att-other',
        userId: 'u-student-1',
        student: 'Chihea',
        studentId: 'SC-1001',
        sessionId: 'sess-other',
        session: 'Keep me',
        location: 'Building A-Room 201',
        recordedAt: new Date(),
        status: 'Present',
        distanceMeters: null,
      },
    );

    await service.remove(created.id, teacher);

    expect(attendanceDelete).toHaveBeenCalledWith(created.id);
    expect(attendanceStore.map((row) => row.id)).toEqual(['att-other']);
    expect(sessionStore.find((row) => row.id === created.id)).toBeUndefined();
  });

  it('hides other teachers sessions from a non-owner teacher', async () => {
    await service.create(
      {
        title: 'Private',
        locationId: 'LOC-001',
        dueAt: dueInMinutes(30),
      },
      teacher,
    );
    expect(await service.findAll(otherTeacher)).toHaveLength(0);
    expect((await service.findAll(admin)).length).toBeGreaterThan(0);
  });

  it('resolves an open session for student scan with a valid QR token', async () => {
    const dueAt = dueInMinutes(40);
    const created = await service.create(
      {
        title: 'Scan resolve',
        locationId: 'LOC-001',
        dueAt,
      },
      teacher,
    );
    const qr = await service.getQr(created.id, teacher);

    const context = await service.resolveOpenSessionForScan(
      created.id,
      qr.token,
    );
    expect(context.id).toBe(created.id);
    expect(context.title).toBe('Scan resolve');
    expect(context.locationName).toContain('Building A');
    expect(context.dueAt).toBeInstanceOf(Date);
    expect(context.openedAt).toBeInstanceOf(Date);
  });

  it('rejects student scan after dueAt even when QR token is still valid', async () => {
    const created = await service.create(
      {
        title: 'Past due',
        locationId: 'LOC-001',
        dueAt: dueInMinutes(30),
      },
      teacher,
    );
    const qr = await service.getQr(created.id, teacher);
    const pastDueClock = new Date(Date.now() + 45 * 60 * 1000);

    await expect(
      service.resolveOpenSessionForScan(created.id, qr.token, pastDueClock),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects student scan for closed session or wrong token', async () => {
    const created = await service.create(
      {
        title: 'Scan reject',
        locationId: 'LOC-001',
        dueAt: dueInMinutes(30),
      },
      teacher,
    );
    const qr = await service.getQr(created.id, teacher);

    await service.close(created.id, teacher);
    await expect(
      service.resolveOpenSessionForScan(created.id, qr.token),
    ).rejects.toThrow(ForbiddenException);

    const open = await service.create(
      {
        title: 'Wrong token',
        locationId: 'LOC-001',
        dueAt: dueInMinutes(30),
      },
      teacher,
    );
    await expect(
      service.resolveOpenSessionForScan(open.id, 'bad-token'),
    ).rejects.toThrow(ForbiddenException);
  });
});

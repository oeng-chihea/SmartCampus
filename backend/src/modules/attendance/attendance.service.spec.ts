import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { AttendanceRecordEntity } from '../../database/entities/attendance-record.entity';
import { SessionEntity } from '../../database/entities/session.entity';
import { AuthService } from '../auth/auth.service';
import { LocationsService } from '../locations/locations.service';
import { LOCATION_SEED } from '../locations/data/locations.seed';
import { SessionsService } from '../sessions/sessions.service';
import { AttendanceService } from './attendance.service';

function dueInMinutes(minutes: number): string {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

describe('AttendanceService', () => {
  let attendance: AttendanceService;
  let sessions: SessionsService;
  let sessionStore: SessionEntity[];
  let recordStore: AttendanceRecordEntity[];

  const teacher = { userId: 'u-teacher-1', role: 'teacher' as const };
  const student = { userId: 'u-student-1', role: 'student' as const };

  beforeEach(() => {
    const locationStore = LOCATION_SEED.map((row) => ({ ...row }));
    sessionStore = [];
    recordStore = [];

    const locations = {
      findActiveById: jest.fn(async (id: string) => {
        const location = locationStore.find((row) => row.id === id);
        if (!location || location.status !== 'Active') {
          throw new Error(`inactive ${id}`);
        }
        return { ...location };
      }),
      incrementSessionsUsing: jest.fn(async () => undefined),
      decrementSessionsUsing: jest.fn(async () => undefined),
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
        if (id === 'u-student-1') {
          return {
            id: 'u-student-1',
            name: 'Sok Dara',
            email: 'student@smartcampus.edu',
            role: 'student' as const,
            studentId: 'SC-1024',
          };
        }
        return null;
      }),
    } as unknown as AuthService;

    const sessionRepo = {
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
      find: jest.fn(async () => [...sessionStore]),
      findOne: jest.fn(async ({ where }: { where: { id: string } }) =>
        sessionStore.find((row) => row.id === where.id) ?? null,
      ),
    } as unknown as Repository<SessionEntity>;

    const attendanceForSessions = {
      createQueryBuilder: jest.fn(() => ({
        delete: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn(async () => ({ affected: 0 })),
      })),
    } as unknown as Repository<AttendanceRecordEntity>;

    sessions = new SessionsService(
      sessionRepo,
      attendanceForSessions,
      locations,
      auth,
    );

    const recordRepo = {
      create: jest.fn((data: Partial<AttendanceRecordEntity>) =>
        ({ ...data }) as AttendanceRecordEntity,
      ),
      save: jest.fn(async (entity: AttendanceRecordEntity) => {
        const dup = recordStore.find(
          (row) =>
            row.studentId === entity.studentId &&
            row.sessionId === entity.sessionId,
        );
        if (dup) {
          const error = new Error('Duplicate entry') as Error & {
            code: string;
          };
          error.code = 'ER_DUP_ENTRY';
          throw error;
        }
        recordStore.push(entity);
        return entity;
      }),
      find: jest.fn(async ({ where }: { where: { userId: string } }) =>
        recordStore
          .filter((row) => row.userId === where.userId)
          .sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime()),
      ),
      findOne: jest.fn(
        async ({
          where,
        }: {
          where: { studentId: string; sessionId: string };
        }) =>
          recordStore.find(
            (row) =>
              row.studentId === where.studentId &&
              row.sessionId === where.sessionId,
          ) ?? null,
      ),
      delete: jest.fn(async (ids: string | string[]) => {
        const idList = Array.isArray(ids) ? ids : [ids];
        recordStore = recordStore.filter((row) => !idList.includes(row.id));
        return { affected: idList.length };
      }),
    } as unknown as Repository<AttendanceRecordEntity>;

    const sessionLookupRepo = {
      find: jest.fn(async ({ where }: { where: { id: unknown } }) => {
        // Used by findMine orphan filter — return all open sessions by id.
        const ids = Array.isArray((where as { id?: { _value?: string[] } }).id)
          ? ((where as { id: string[] }).id as string[])
          : [];
        // TypeORM In() criteria is opaque in unit tests; keep all session ids from store.
        return sessionStore.map((row) => ({ id: row.id }));
      }),
    } as unknown as Repository<SessionEntity>;

    attendance = new AttendanceService(
      recordRepo,
      sessionLookupRepo,
      sessions,
      auth,
    );
  });

  async function openSessionWithPayload(dueMinutes = 45): Promise<{
    sessionId: string;
    payload: string;
  }> {
    const created = await sessions.create(
      {
        title: 'SE401 · Morning Lecture',
        locationId: 'LOC-001',
        dueAt: dueInMinutes(dueMinutes),
      },
      teacher,
    );
    const qr = await sessions.getQr(created.id, teacher);
    return { sessionId: created.id, payload: qr.payload };
  }

  it('submits Present when before the due time', async () => {
    const { payload } = await openSessionWithPayload(45);

    const record = await attendance.submit({ payload }, student);

    expect(record.status).toBe('Present');
    expect(record.student).toBe('Sok Dara');
    expect(record.studentId).toBe('SC-1024');
    expect(record.session).toBe('SE401 · Morning Lecture');
    expect(record.location).toContain('Building A');
    expect(record.distanceMeters).toBeNull();
    expect(record.id).toMatch(/^att-/);
  });

  it('rejects submit after the due time', async () => {
    const created = await sessions.create(
      {
        title: 'Due soon lab',
        locationId: 'LOC-002',
        dueAt: dueInMinutes(15),
      },
      teacher,
    );
    const qr = await sessions.getQr(created.id, teacher);
    const afterDue = new Date(Date.now() + 20 * 60 * 1000);

    await expect(
      attendance.submit({ payload: qr.payload }, student, afterDue),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects duplicate submit for the same student and session', async () => {
    const { payload } = await openSessionWithPayload();
    await attendance.submit({ payload }, student);

    await expect(attendance.submit({ payload }, student)).rejects.toThrow(
      ConflictException,
    );
  });

  it('rejects invalid payload format', () => {
    expect(() => attendance.parsePayload('not-valid')).toThrow(
      BadRequestException,
    );
  });

  it('rejects scan when session is closed', async () => {
    const created = await sessions.create(
      {
        title: 'Closed',
        locationId: 'LOC-001',
        dueAt: dueInMinutes(30),
      },
      teacher,
    );
    const qr = await sessions.getQr(created.id, teacher);
    await sessions.close(created.id, teacher);

    await expect(
      attendance.submit({ payload: qr.payload }, student),
    ).rejects.toThrow(ForbiddenException);
  });
});

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
      /** In-memory QueryBuilder stand-in for findPage pagination + search. */
      createQueryBuilder: jest.fn(() => {
        let teacherId: string | undefined;
        let searchQ: string | undefined;
        let skipN = 0;
        let takeN: number | undefined;

        const applyFilters = (): SessionEntity[] => {
          let rows = [...sessionStore].sort(
            (a, b) => b.openedAt.getTime() - a.openedAt.getTime(),
          );
          if (teacherId) {
            rows = rows.filter((row) => row.teacherId === teacherId);
          }
          if (searchQ) {
            const needle = searchQ.toLowerCase();
            rows = rows.filter(
              (row) =>
                row.title.toLowerCase().includes(needle) ||
                row.locationName.toLowerCase().includes(needle) ||
                row.teacherName.toLowerCase().includes(needle),
            );
          }
          return rows;
        };

        const qb = {
          orderBy: jest.fn().mockReturnThis(),
          andWhere: jest.fn((clause: string, params?: Record<string, string>) => {
            if (params?.teacherId) {
              teacherId = params.teacherId;
            }
            if (params?.q) {
              // Stored as `%needle%` from the service
              searchQ = String(params.q).replace(/%/g, '');
            }
            return qb;
          }),
          skip: jest.fn((n: number) => {
            skipN = n;
            return qb;
          }),
          take: jest.fn((n: number) => {
            takeN = n;
            return qb;
          }),
          getCount: jest.fn(async () => applyFilters().length),
          getMany: jest.fn(async () => {
            const rows = applyFilters();
            if (takeN == null) {
              return rows.slice(skipN);
            }
            return rows.slice(skipN, skipN + takeN);
          }),
        };
        return qb;
      }),
    } as unknown as Repository<SessionEntity>;

    const attendanceRepo = {
      createQueryBuilder: jest.fn(() => {
        let sessionId: string | undefined;
        let status: string | undefined;
        const qb = {
          delete: jest.fn().mockReturnThis(),
          from: jest.fn().mockReturnThis(),
          where: jest.fn(
            (_clause: string, params?: { sessionId?: string }) => {
              if (params?.sessionId) {
                sessionId = params.sessionId;
              }
              return qb;
            },
          ),
          andWhere: jest.fn(
            (_clause: string, params?: { status?: string }) => {
              if (params?.status) {
                status = params.status;
              }
              return qb;
            },
          ),
          execute: jest.fn(async () => {
            if (!sessionId) {
              return { affected: 0 };
            }
            if (status === 'Absent') {
              const before = attendanceStore.length;
              attendanceStore = attendanceStore.filter(
                (row) =>
                  !(row.sessionId === sessionId && row.status === 'Absent'),
              );
              return { affected: before - attendanceStore.length };
            }
            await attendanceDelete(sessionId);
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

  it('creates a session when dueAt is now or already in the past', async () => {
    const nowDue = dueInMinutes(0);
    const nowSession = await service.create(
      {
        title: 'Due now',
        locationId: 'LOC-001',
        dueAt: nowDue,
      },
      teacher,
    );
    expect(nowSession.dueAt).toBe(new Date(nowDue).toISOString());

    const pastDue = dueInMinutes(-10);
    const pastSession = await service.create(
      {
        title: 'Already past due',
        locationId: 'LOC-001',
        dueAt: pastDue,
      },
      teacher,
    );
    expect(pastSession.dueAt).toBe(new Date(pastDue).toISOString());
    expect(pastSession.status).toBe('Open');
  });

  it('rejects create when dueAt is not a valid date', async () => {
    await expect(
      service.create(
        {
          title: 'Bad due time',
          locationId: 'LOC-001',
          dueAt: 'not-a-date',
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
    expect((await service.findAll(teacher)).length).toBeGreaterThan(0);
  });

  it('paginates sessions with a default page size of 10 and optional search', async () => {
    for (let i = 0; i < 12; i += 1) {
      await service.create(
        {
          title: i % 2 === 0 ? `Alpha class ${i}` : `Beta class ${i}`,
          locationId: 'LOC-001',
          dueAt: dueInMinutes(30 + i),
        },
        teacher,
      );
    }

    const page1 = await service.findPage(teacher, { page: 1, limit: 10 });
    expect(page1.items).toHaveLength(10);
    expect(page1.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 12,
      totalPages: 2,
    });

    const page2 = await service.findPage(teacher, { page: 2, limit: 10 });
    expect(page2.items).toHaveLength(2);
    expect(page2.pagination.page).toBe(2);

    const search = await service.findPage(teacher, {
      page: 1,
      limit: 10,
      q: 'alpha',
    });
    expect(search.pagination.total).toBe(6);
    expect(search.items.every((row) => /alpha/i.test(row.title))).toBe(true);

    const otherPage = await service.findPage(otherTeacher, {
      page: 1,
      limit: 10,
    });
    expect(otherPage.items).toHaveLength(0);
    expect(otherPage.pagination.total).toBe(0);
  });

  it('includes the campus zone coordinates on the student open list', async () => {
    await service.create(
      {
        title: 'Live map session',
        locationId: 'LOC-001',
        dueAt: dueInMinutes(40),
      },
      teacher,
    );

    const live = await service.listOpenLive();
    expect(live).toHaveLength(1);
    expect(live[0]).toMatchObject({
      title: 'Live map session',
      locationId: 'LOC-001',
      locationName: 'Building A, Room 201',
      latitude: 11.5479313,
      longitude: 104.9405941,
      radiusMeters: 200,
    });
    expect(live[0].qr.payload).toContain('SMARTCAMPUS|');
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

  it('edits title and location without rotating QR, changing status, or moving dueAt', async () => {
    const originalDue = dueInMinutes(30);
    const created = await service.create(
      {
        title: 'Original title',
        locationId: 'LOC-001',
        dueAt: originalDue,
      },
      teacher,
    );
    const qrBefore = await service.getQr(created.id, teacher);

    const edited = await service.edit(
      created.id,
      {
        title: 'Updated lecture',
        locationId: 'LOC-002',
      },
      teacher,
    );

    expect(edited.id).toBe(created.id);
    expect(edited.status).toBe('Open');
    expect(edited.title).toBe('Updated lecture');
    expect(edited.locationId).toBe('LOC-002');
    expect(edited.locationName).toContain('Building B');
    expect(edited.dueAt).toBe(created.dueAt);
    expect(edited.teacherId).toBe(teacher.userId);
    expect(edited.openedAt).toBe(created.openedAt);

    const qrAfter = await service.getQr(created.id, teacher);
    expect(qrAfter.token).toBe(qrBefore.token);
    expect(
      locationStore.find((row) => row.id === 'LOC-001')?.sessionsUsing,
    ).toBe(0);
    expect(
      locationStore.find((row) => row.id === 'LOC-002')?.sessionsUsing,
    ).toBe(1);
  });

  it('does not change location usage when the open session stays on the same zone', async () => {
    const created = await service.create(
      {
        title: 'Same room',
        locationId: 'LOC-001',
        dueAt: dueInMinutes(30),
      },
      teacher,
    );

    await service.edit(
      created.id,
      {
        title: 'Same room renamed',
        locationId: 'LOC-001',
      },
      teacher,
    );

    expect(
      locationStore.find((row) => row.id === 'LOC-001')?.sessionsUsing,
    ).toBe(1);
  });

  it('edits a closed session without restoring location usage or reopening it', async () => {
    const created = await service.create(
      {
        title: 'Will close',
        locationId: 'LOC-001',
        dueAt: dueInMinutes(30),
      },
      teacher,
    );
    await service.close(created.id, teacher);
    expect(
      locationStore.find((row) => row.id === 'LOC-001')?.sessionsUsing,
    ).toBe(0);

    const edited = await service.edit(
      created.id,
      {
        title: 'Closed but corrected',
        locationId: 'LOC-002',
      },
      teacher,
    );

    expect(edited.status).toBe('Closed');
    expect(edited.title).toBe('Closed but corrected');
    expect(edited.locationId).toBe('LOC-002');
    expect(
      locationStore.find((row) => row.id === 'LOC-001')?.sessionsUsing,
    ).toBe(0);
    expect(
      locationStore.find((row) => row.id === 'LOC-002')?.sessionsUsing,
    ).toBe(0);
  });

  it('rejects edit on an inactive location, missing session, or other teacher', async () => {
    const created = await service.create(
      {
        title: 'Guard rails',
        locationId: 'LOC-001',
        dueAt: dueInMinutes(30),
      },
      teacher,
    );

    await expect(
      service.edit(
        created.id,
        {
          title: 'Blocked location',
          locationId: 'LOC-005',
        },
        teacher,
      ),
    ).rejects.toThrow(NotFoundException);

    await expect(
      service.edit(
        'sess-missing',
        {
          title: 'Ghost session',
          locationId: 'LOC-001',
        },
        teacher,
      ),
    ).rejects.toThrow(NotFoundException);

    await expect(
      service.edit(
        created.id,
        {
          title: 'Not my session',
          locationId: 'LOC-001',
        },
        otherTeacher,
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('keeps dueAt and Absent rows when title or location is edited', async () => {
    const created = await service.create(
      {
        title: 'Due locked',
        locationId: 'LOC-001',
        dueAt: dueInMinutes(-10),
      },
      teacher,
    );
    const row = sessionStore.find((entry) => entry.id === created.id);
    expect(row).toBeDefined();
    row!.absentsFinalized = true;
    attendanceStore.push(
      {
        id: 'att-present',
        userId: 'u-student-1',
        student: 'Sok Dara',
        studentId: 'SC-1024',
        sessionId: created.id,
        session: created.title,
        location: created.locationName,
        recordedAt: new Date(),
        status: 'Present',
        distanceMeters: 8,
      } as AttendanceRecordEntity,
      {
        id: 'att-absent',
        userId: 'u-student-2',
        student: 'Chihea',
        studentId: 'SC-1001',
        sessionId: created.id,
        session: created.title,
        location: created.locationName,
        recordedAt: new Date(),
        status: 'Absent',
        distanceMeters: null,
      } as AttendanceRecordEntity,
    );

    const edited = await service.edit(
      created.id,
      {
        title: 'Due still locked',
        locationId: 'LOC-002',
      },
      teacher,
    );

    expect(edited.dueAt).toBe(created.dueAt);
    expect(attendanceStore.map((entry) => entry.id)).toEqual([
      'att-present',
      'att-absent',
    ]);
    expect(
      sessionStore.find((entry) => entry.id === created.id)?.absentsFinalized,
    ).toBe(true);
  });
});

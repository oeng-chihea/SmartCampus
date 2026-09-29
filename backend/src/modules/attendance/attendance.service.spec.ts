import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import ExcelJS from 'exceljs';
import { Repository } from 'typeorm';
import { AttendanceRecordEntity } from '../../database/entities/attendance-record.entity';
import { SessionEntity } from '../../database/entities/session.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { AuthService } from '../auth/auth.service';
import { LocationsService } from '../locations/locations.service';
import { LOCATION_SEED } from '../locations/data/locations.seed';
import { SessionsService } from '../sessions/sessions.service';
import { AttendanceService } from './attendance.service';
import { ReverseGeocodeService } from './reverse-geocode.service';

function dueInMinutes(minutes: number): string {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

describe('AttendanceService', () => {
  let attendance: AttendanceService;
  let sessions: SessionsService;
  let sessionStore: SessionEntity[];
  let recordStore: AttendanceRecordEntity[];
  let studentStore: StudentEntity[];

  const teacher = { userId: 'u-teacher-1', role: 'teacher' as const };
  const student = { userId: 'u-student-1', role: 'student' as const };
  const otherStudent = { userId: 'u-student-2', role: 'student' as const };

  beforeEach(() => {
    const locationStore = LOCATION_SEED.map((row) => ({ ...row }));
    sessionStore = [];
    recordStore = [];
    studentStore = [
      {
        studentId: 'SC-1024',
        name: 'Sok Dara',
        email: 'student@smartcampus.edu',
        course: 'SE401',
        year: 'Year 1',
        attendanceRate: 0,
        status: 'Active',
        loginEnabled: true,
        userId: 'u-student-1',
      },
      {
        studentId: 'SC-1001',
        name: 'Chihea',
        email: 'chihea@smartcampus.edu',
        course: 'SE401',
        year: 'Year 1',
        attendanceRate: 0,
        status: 'Active',
        loginEnabled: true,
        userId: 'u-student-2',
      },
      {
        studentId: 'SC-1999',
        name: 'No Account',
        email: 'none@smartcampus.edu',
        course: 'SE401',
        year: 'Year 1',
        attendanceRate: 0,
        status: 'Active',
        loginEnabled: false,
        userId: null,
      },
    ];

    const locations = {
      findActiveById: jest.fn(async (id: string) => {
        const location = locationStore.find((row) => row.id === id);
        if (!location || location.status !== 'Active') {
          throw new Error(`inactive ${id}`);
        }
        return { ...location };
      }),
      findOne: jest.fn(async (id: string) => {
        const location = locationStore.find((row) => row.id === id);
        if (!location) {
          throw new Error(`not found ${id}`);
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
        if (id === 'u-student-2') {
          return {
            id: 'u-student-2',
            name: 'Chihea',
            email: 'chihea@smartcampus.edu',
            role: 'student' as const,
            studentId: 'SC-1001',
          };
        }
        return null;
      }),
    } as unknown as AuthService;

    const sessionRepo = {
      create: jest.fn(
        (data: Partial<SessionEntity>) => ({ ...data }) as SessionEntity,
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
      findOne: jest.fn(
        async ({ where }: { where: { id: string } }) =>
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
      create: jest.fn(
        (data: Partial<AttendanceRecordEntity>) =>
          ({ ...data }) as AttendanceRecordEntity,
      ),
      save: jest.fn(async (entity: AttendanceRecordEntity) => {
        const byId = recordStore.find((row) => row.id === entity.id);
        if (byId) {
          Object.assign(byId, entity);
          return byId;
        }
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
      update: jest.fn(async () => ({ affected: 1 })),
      find: jest.fn(
        async (options?: {
          where?: { userId?: string; sessionId?: unknown };
        }) => {
          let rows = [...recordStore];
          if (options?.where?.userId) {
            rows = rows.filter((row) => row.userId === options.where?.userId);
          }
          if (options?.where?.sessionId) {
            const sessionFilter = options.where.sessionId as {
              _value?: string | string[];
            };
            const sessionIds = Array.isArray(sessionFilter._value)
              ? sessionFilter._value
              : [String(sessionFilter._value ?? options.where.sessionId)];
            rows = rows.filter((row) => sessionIds.includes(row.sessionId));
          }
          return rows.sort(
            (a, b) => b.recordedAt.getTime() - a.recordedAt.getTime(),
          );
        },
      ),
      createQueryBuilder: jest.fn((alias?: string) => {
        if (!alias) {
          let values: AttendanceRecordEntity[] = [];
          const insertBuilder = {
            insert: jest.fn().mockReturnThis(),
            into: jest.fn().mockReturnThis(),
            values: jest.fn((rows: AttendanceRecordEntity[]) => {
              values = rows;
              return insertBuilder;
            }),
            orIgnore: jest.fn().mockReturnThis(),
            execute: jest.fn(async () => {
              for (const row of values) {
                const alreadyRecorded = recordStore.some(
                  (existing) =>
                    existing.studentId === row.studentId &&
                    existing.sessionId === row.sessionId,
                );
                if (!alreadyRecorded) {
                  recordStore.push(row);
                }
              }
              return { affected: values.length };
            }),
          };
          return insertBuilder;
        }

        let teacherId: string | undefined;
        let searchNeedle: string | undefined;
        let sessionId: string | undefined;
        let status: string | undefined;
        let checkInStatus: string | undefined;
        let excludeStatus: string | undefined;
        let excludeAttendanceStatus: string | undefined;
        let rangeStart: Date | undefined;
        let rangeEnd: Date | undefined;

        const apply = (): AttendanceRecordEntity[] =>
          recordStore
            .filter((row) => {
              if (searchNeedle) {
                const haystack =
                  `${row.student} ${row.studentId}`.toLowerCase();
                if (!haystack.includes(searchNeedle.toLowerCase())) {
                  return false;
                }
              }
              if (sessionId && row.sessionId !== sessionId) {
                return false;
              }
              if (status && row.status !== status) {
                return false;
              }
              if (checkInStatus && row.attendanceStatus !== checkInStatus) {
                return false;
              }
              if (excludeStatus && row.status === excludeStatus) {
                return false;
              }
              if (
                excludeAttendanceStatus &&
                row.attendanceStatus === excludeAttendanceStatus
              ) {
                return false;
              }
              if (rangeStart && row.recordedAt < rangeStart) {
                return false;
              }
              if (rangeEnd && row.recordedAt >= rangeEnd) {
                return false;
              }
              if (teacherId) {
                const session = sessionStore.find(
                  (entry) => entry.id === row.sessionId,
                );
                if (!session || session.teacherId !== teacherId) {
                  return false;
                }
              }
              return true;
            })
            .sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime());

        const qb = {
          orderBy: jest.fn().mockReturnThis(),
          innerJoin: jest.fn().mockReturnThis(),
          andWhere: jest.fn(
            (_clause: string, params?: Record<string, unknown>) => {
              if (params?.needle) {
                searchNeedle = String(params.needle).replace(/%/g, '');
              }
              if (params?.sessionId) {
                sessionId = String(params.sessionId);
              }
              if (params?.insideStatus) {
                status = String(params.insideStatus);
              }
              if (params?.outsideStatus) {
                status = String(params.outsideStatus);
              }
              if (params?.checkInStatus) {
                checkInStatus = String(params.checkInStatus);
              }
              if (params?.absentStatus) {
                excludeAttendanceStatus = String(params.absentStatus);
              }
              if (params?.rangeStart) {
                rangeStart = params.rangeStart as Date;
              }
              if (params?.rangeEnd) {
                rangeEnd = params.rangeEnd as Date;
              }
              if (params?.teacherId) {
                teacherId = String(params.teacherId);
              }
              return qb;
            },
          ),
          getMany: jest.fn(async () => apply()),
        };
        return qb;
      }),
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
      delete: jest.fn(
        async (
          criteria:
            | string
            | string[]
            | {
                sessionId?: string;
                status?: string;
                attendanceStatus?: string;
              },
        ) => {
          if (typeof criteria === 'string' || Array.isArray(criteria)) {
            const idList = Array.isArray(criteria) ? criteria : [criteria];
            recordStore = recordStore.filter((row) => !idList.includes(row.id));
            return { affected: idList.length };
          }
          const before = recordStore.length;
          recordStore = recordStore.filter((row) => {
            const sessionMatch =
              !criteria.sessionId || row.sessionId === criteria.sessionId;
            const statusMatch =
              !criteria.status || row.status === criteria.status;
            const attendanceStatusMatch =
              !criteria.attendanceStatus ||
              row.attendanceStatus === criteria.attendanceStatus;
            return !(sessionMatch && statusMatch && attendanceStatusMatch);
          });
          return { affected: before - recordStore.length };
        },
      ),
    } as unknown as Repository<AttendanceRecordEntity>;

    const sessionLookupRepo = {
      find: jest.fn(async (options?: { where?: unknown }) => {
        let rows = [...sessionStore];
        const where = (options?.where ?? {}) as {
          id?: unknown;
          absentsFinalized?: boolean;
          teacherId?: string;
        };
        if (typeof where.absentsFinalized === 'boolean') {
          rows = rows.filter(
            (row) => Boolean(row.absentsFinalized) === where.absentsFinalized,
          );
        }
        if (typeof where.teacherId === 'string') {
          rows = rows.filter((row) => row.teacherId === where.teacherId);
        }
        return rows;
      }),
      save: jest.fn(async (entity: SessionEntity) => {
        const index = sessionStore.findIndex((row) => row.id === entity.id);
        if (index >= 0) {
          sessionStore[index] = entity;
        } else {
          sessionStore.push(entity);
        }
        return entity;
      }),
      update: jest.fn(
        async (
          criteria: { id?: { _value?: string[] } },
          values: Partial<SessionEntity>,
        ) => {
          const ids = criteria.id?._value ?? [];
          let affected = 0;
          for (const session of sessionStore) {
            if (ids.includes(session.id)) {
              Object.assign(session, values);
              affected += 1;
            }
          }
          return { affected };
        },
      ),
      createQueryBuilder: jest.fn(() => {
        let teacherId: string | undefined;
        let requireUnfinalized = false;
        let nowCutoff: Date | undefined;
        let requireEligible = false;

        const qb = {
          where: jest.fn(
            (_clause: string, params?: Record<string, unknown>) => {
              if (params && 'finalized' in params) {
                requireUnfinalized = true;
              }
              return qb;
            },
          ),
          andWhere: jest.fn(
            (_clause: string, params?: Record<string, unknown>) => {
              if (params?.teacherId) {
                teacherId = String(params.teacherId);
              }
              if (params?.now) {
                nowCutoff = params.now as Date;
                requireEligible = true;
              }
              if (params?.closed) {
                requireEligible = true;
              }
              return qb;
            },
          ),
          getMany: jest.fn(async () =>
            sessionStore.filter((session) => {
              if (requireUnfinalized && session.absentsFinalized) {
                return false;
              }
              if (teacherId && session.teacherId !== teacherId) {
                return false;
              }
              if (requireEligible) {
                const closed = session.status === 'Closed';
                const pastDue =
                  session.dueAt != null &&
                  nowCutoff != null &&
                  session.dueAt.getTime() <= nowCutoff.getTime();
                if (!closed && !pastDue) {
                  return false;
                }
              }
              return true;
            }),
          ),
        };
        return qb;
      }),
    } as unknown as Repository<SessionEntity>;

    const studentRepo = {
      find: jest.fn(async () =>
        studentStore.filter((row) => row.userId != null),
      ),
    } as unknown as Repository<StudentEntity>;

    const reverseGeocode = {
      lookup: jest.fn(
        async () =>
          'Institute of Technology of Cambodia, Russian Federation Boulevard, Phnom Penh',
      ),
    } as unknown as ReverseGeocodeService;

    attendance = new AttendanceService(
      recordRepo,
      sessionLookupRepo,
      studentRepo,
      sessions,
      locations,
      auth,
      reverseGeocode,
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

  it('submits Inside location status and Present attendance status inside the geofence', async () => {
    const { payload } = await openSessionWithPayload(45);
    // LOC-001 is KIT Phnom Penh (11.5479313, 104.9405941), 200m radius.
    const record = await attendance.submit(
      { payload, latitude: 11.54795, longitude: 104.94061, accuracyMeters: 18 },
      student,
    );

    expect(record.status).toBe('Inside');
    expect(record.attendanceStatus).toBe('Present');
    expect(record.student).toBe('Sok Dara');
    expect(record.studentId).toBe('SC-1024');
    expect(record.session).toBe('SE401 · Morning Lecture');
    expect(record.sessionId).toMatch(/^sess-/);
    expect(record.location).toContain('Building A');
    expect(record.distanceMeters).not.toBeNull();
    expect(record.latitude).toBe(11.54795);
    expect(record.longitude).toBe(104.94061);
    expect(record.scannedLocation).toContain(
      'Institute of Technology of Cambodia',
    );
    expect(record.accuracyMeters).toBe(18);
    expect(record.id).toMatch(/^att-/);
  });

  it('rejects submit when no location coordinates are provided (FR-02 hard gate)', async () => {
    const { payload } = await openSessionWithPayload(45);

    await expect(attendance.submit({ payload }, student)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects submit with only one of latitude/longitude', async () => {
    const { payload } = await openSessionWithPayload(45);

    await expect(
      attendance.submit({ payload, latitude: 11.5479313 }, student),
    ).rejects.toThrow(BadRequestException);
  });

  it('stores Inside and Present independently when GPS is inside the geofence', async () => {
    const { payload } = await openSessionWithPayload(45);
    // LOC-001 is KIT Phnom Penh (11.5479313, 104.9405941), 200m radius.
    const record = await attendance.submit(
      { payload, latitude: 11.54795, longitude: 104.94061, accuracyMeters: 12 },
      student,
    );

    expect(record.status).toBe('Inside');
    expect(record.attendanceStatus).toBe('Present');
    expect(record.distanceMeters).not.toBeNull();
    expect(record.distanceMeters as number).toBeLessThanOrEqual(200);
    expect(record.latitude).toBe(11.54795);
    expect(record.longitude).toBe(104.94061);
  });

  it('marks Outside Location when GPS falls outside the geofence radius', async () => {
    const { payload } = await openSessionWithPayload(45);
    // Same session (LOC-001, 200m radius) but far outside coordinates.
    const record = await attendance.submit(
      { payload, latitude: 11.6, longitude: 105.0, accuracyMeters: 20 },
      student,
    );

    expect(record.status).toBe('Outside Location');
    expect(record.attendanceStatus).toBe('Present');
    expect(record.distanceMeters as number).toBeGreaterThan(200);
    expect(record.latitude).toBe(11.6);
    expect(record.longitude).toBe(105.0);
  });

  it('submits Inside for a Galileo Street scan inside the 200 m KIT zone', async () => {
    const { payload } = await openSessionWithPayload(45);
    // ~131 m south of the Maps pin — previously Outside Location at 80 m.
    const record = await attendance.submit(
      {
        payload,
        latitude: 11.546736,
        longitude: 104.940616,
        accuracyMeters: 18,
      },
      student,
    );

    expect(record.status).toBe('Inside');
    expect(record.attendanceStatus).toBe('Present');
    expect(record.distanceMeters as number).toBeGreaterThan(100);
    expect(record.distanceMeters as number).toBeLessThanOrEqual(200);
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
    const coords = {
      latitude: 11.5479313,
      longitude: 104.9405941,
      accuracyMeters: 18,
    };
    await attendance.submit({ payload, ...coords }, student);

    await expect(
      attendance.submit({ payload, ...coords }, student),
    ).rejects.toThrow(ConflictException);
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

  it('does not write Absent rows while the session is still before due', async () => {
    await openSessionWithPayload(45);

    const page = await attendance.findAdminRecords({}, teacher);

    expect(page.records).toEqual([]);
    expect(page.metrics).toEqual({
      present: 0,
      late: 0,
      absent: 0,
      outsideLocation: 0,
    });
    expect(page.statusOptions).toEqual(['Inside', 'Outside Location']);
    expect(page.attendanceStatusOptions).toEqual(['Present', 'Absent']);
  });

  it('lists only students who scanned while the session is still before due', async () => {
    const { payload } = await openSessionWithPayload(45);
    await attendance.submit(
      {
        payload,
        latitude: 11.54795,
        longitude: 104.94061,
        accuracyMeters: 18,
      },
      student,
    );

    const page = await attendance.findAdminRecords({}, teacher);

    expect(page.records).toHaveLength(1);
    expect(page.records[0]).toMatchObject({
      studentId: 'SC-1024',
      status: 'Inside',
      attendanceStatus: 'Present',
    });
    expect(page.metrics).toMatchObject({ present: 1, absent: 0 });
  });

  it('records Absent for roster students who did not scan after due time', async () => {
    const { sessionId, payload } = await openSessionWithPayload(45);
    await attendance.submit(
      {
        payload,
        latitude: 11.54795,
        longitude: 104.94061,
        accuracyMeters: 18,
      },
      student,
    );

    const afterDue = new Date(Date.now() + 50 * 60 * 1000);
    const page = await attendance.findAdminRecords({}, teacher, afterDue);

    expect(page.records).toHaveLength(2);
    const scanner = page.records.find((row) => row.studentId === 'SC-1024');
    const missing = page.records.find((row) => row.studentId === 'SC-1001');
    expect(scanner).toMatchObject({
      status: 'Inside',
      attendanceStatus: 'Present',
    });
    expect(missing).toMatchObject({
      status: null,
      attendanceStatus: 'Absent',
      student: 'Chihea',
      distanceMeters: null,
      latitude: null,
    });
    expect(page.records.some((row) => row.studentId === 'SC-1999')).toBe(false);
    expect(page.metrics).toMatchObject({ present: 1, absent: 1 });
    expect(
      sessionStore.find((row) => row.id === sessionId)?.absentsFinalized,
    ).toBe(true);
  });

  it('does not backfill a student created after absents were finalized', async () => {
    await openSessionWithPayload(45);
    const afterDue = new Date(Date.now() + 50 * 60 * 1000);
    await attendance.findAdminRecords({}, teacher, afterDue);

    studentStore.push({
      studentId: 'SC-3000',
      name: 'New Student',
      email: 'new@smartcampus.edu',
      course: 'SE401',
      year: 'Year 1',
      attendanceRate: 0,
      status: 'Active',
      loginEnabled: true,
      userId: 'u-student-3',
    });

    const page = await attendance.findAdminRecords({}, teacher, afterDue);
    expect(page.records.some((row) => row.studentId === 'SC-3000')).toBe(false);
  });

  it('does not list the roster as Absent when the session is closed before due', async () => {
    const { payload } = await openSessionWithPayload(45);
    await attendance.submit(
      {
        payload,
        latitude: 11.54795,
        longitude: 104.94061,
        accuracyMeters: 18,
      },
      student,
    );
    const created = sessionStore[0];
    await sessions.close(created.id, teacher);

    const page = await attendance.findAdminRecords({}, teacher);
    expect(page.records).toHaveLength(1);
    expect(page.records[0].studentId).toBe('SC-1024');
    expect(page.records[0].attendanceStatus).toBe('Present');
  });

  it('removes premature Absent rows if due time is still ahead', async () => {
    const { sessionId } = await openSessionWithPayload(45);
    const session = sessionStore.find((row) => row.id === sessionId);
    expect(session).toBeDefined();
    session!.absentsFinalized = true;
    recordStore.push({
      id: 'att-premature',
      userId: 'u-student-2',
      student: 'Chihea',
      studentId: 'SC-1001',
      sessionId,
      session: 'SE401 · Morning Lecture',
      location: 'Building A, Room 201',
      recordedAt: new Date(),
      status: null,
      attendanceStatus: 'Absent',
      distanceMeters: null,
      latitude: null,
      longitude: null,
      scannedLocation: null,
      accuracyMeters: null,
    } as AttendanceRecordEntity);

    const page = await attendance.findAdminRecords({}, teacher);
    expect(page.records).toEqual([]);
    expect(
      sessionStore.find((row) => row.id === sessionId)?.absentsFinalized,
    ).toBe(false);
  });

  it('limits teacher attendance (including absents) to their own sessions', async () => {
    await openSessionWithPayload(45);
    sessionStore.push({
      id: 'sess-other-teacher',
      title: 'Other class',
      locationId: 'LOC-001',
      locationName: 'Building A, Room 201',
      teacherId: 'u-teacher-other',
      teacherName: 'Other',
      status: 'Open',
      absentsFinalized: false,
      dueAt: new Date(Date.now() - 60_000),
      createdAt: new Date(),
      openedAt: new Date(),
      closedAt: null,
      qrToken: 'tok',
      qrIssuedAt: new Date(),
      qrExpiresAt: new Date(Date.now() + 300_000),
    } as SessionEntity);

    const afterDue = new Date(Date.now() + 50 * 60 * 1000);
    const teacherPage = await attendance.findAdminRecords(
      {},
      teacher,
      afterDue,
    );
    expect(
      teacherPage.records.every(
        (row) => row.sessionId !== 'sess-other-teacher',
      ),
    ).toBe(true);
  });

  it('hides Absent rows from student My attendance', async () => {
    const { payload } = await openSessionWithPayload(45);
    await attendance.submit(
      {
        payload,
        latitude: 11.54795,
        longitude: 104.94061,
        accuracyMeters: 18,
      },
      student,
    );
    const afterDue = new Date(Date.now() + 50 * 60 * 1000);
    await attendance.findAdminRecords({}, teacher, afterDue);

    const mine = await attendance.findMine(student);
    expect(mine).toHaveLength(1);
    expect(mine[0].status).toBe('Inside');
    expect(mine[0].attendanceStatus).toBe('Present');

    const otherMine = await attendance.findMine(otherStudent);
    expect(otherMine).toEqual([]);
  });

  it('filters admin records by inside/outside location and attendance status', async () => {
    const { payload } = await openSessionWithPayload(45);
    await attendance.submit(
      {
        payload,
        latitude: 11.54795,
        longitude: 104.94061,
        accuracyMeters: 18,
      },
      student,
    );
    const afterDue = new Date(Date.now() + 50 * 60 * 1000);
    await attendance.findAdminRecords({}, teacher, afterDue);

    const inside = await attendance.findAdminRecords(
      { status: 'inside' },
      teacher,
      afterDue,
    );
    expect(inside.records).toHaveLength(1);
    expect(inside.records[0].status).toBe('Inside');

    const outside = await attendance.findAdminRecords(
      { status: 'outside' },
      teacher,
      afterDue,
    );
    expect(outside.records).toEqual([]);

    const present = await attendance.findAdminRecords(
      { attendanceStatus: 'Present' },
      teacher,
      afterDue,
    );
    expect(
      present.records.every((row) => row.attendanceStatus === 'Present'),
    ).toBe(true);
    expect(present.records).toHaveLength(1);

    const absents = await attendance.findAdminRecords(
      { attendanceStatus: 'Absent' },
      teacher,
      afterDue,
    );
    expect(
      absents.records.every((row) => row.attendanceStatus === 'Absent'),
    ).toBe(true);
    expect(absents.records.length).toBeGreaterThan(0);
  });

  it('keeps an Outside Location scan in the Present attendance filter', async () => {
    const { payload } = await openSessionWithPayload(45);
    await attendance.submit(
      {
        payload,
        latitude: 11.54795,
        longitude: 104.94061,
        accuracyMeters: 18,
      },
      student,
    );
    await attendance.submit(
      {
        payload,
        latitude: 11.6,
        longitude: 105.0,
        accuracyMeters: 20,
      },
      otherStudent,
    );

    const present = await attendance.findAdminRecords(
      { attendanceStatus: 'Present' },
      teacher,
    );

    expect(present.records).toHaveLength(2);
    expect(present.records.map((row) => row.status).sort()).toEqual([
      'Inside',
      'Outside Location',
    ]);
    expect(
      present.records.every((row) => row.attendanceStatus === 'Present'),
    ).toBe(true);
  });

  it('exports filtered attendance records as an xlsx workbook', async () => {
    const { payload } = await openSessionWithPayload(45);
    await attendance.submit(
      {
        payload,
        latitude: 11.54795,
        longitude: 104.94061,
        accuracyMeters: 18,
      },
      student,
    );

    const now = new Date(2026, 7, 20, 12, 0, 0);
    const file = await attendance.exportAdminExcel({}, teacher, now);

    expect(file.filename).toBe('attendance-records-2026-08-20.xlsx');
    expect(file.buffer.subarray(0, 2).toString()).toBe('PK');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer);
    const sheet = workbook.getWorksheet('Attendance records');
    expect(sheet).toBeDefined();
    expect(sheet?.getRow(1).getCell(1).value).toBe('Student');
    const headers: string[] = [];
    sheet?.getRow(1).eachCell((cell) => headers.push(String(cell.value ?? '')));
    expect(headers).not.toContain('GPS accuracy (m)');
    expect(sheet?.getRow(2).getCell(1).value).toBe('Sok Dara');
    expect(String(sheet?.getRow(2).getCell(5).value)).toContain(
      'Institute of Technology of Cambodia',
    );
    expect(workbook.getWorksheet('Summary')).toBeDefined();
  });
});

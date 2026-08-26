import { NotFoundException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { Repository } from 'typeorm';
import { USER_ROLES } from '../../common/constants/roles.constant';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AttendanceRecordEntity } from '../../database/entities/attendance-record.entity';
import { LocationEntity } from '../../database/entities/location.entity';
import { SessionEntity } from '../../database/entities/session.entity';
import { LOCATION_SEED } from './data/locations.seed';
import { LocationsService } from './locations.service';

describe('LocationsService', () => {
  let service: LocationsService;
  let store: LocationEntity[];
  let sessions: SessionEntity[];
  let records: AttendanceRecordEntity[];

  const teacher: AuthenticatedUser = {
    userId: 'user-teacher',
    role: USER_ROLES.teacher,
  };

  beforeEach(() => {
    store = LOCATION_SEED.map((row) => ({ ...row }) as LocationEntity);
    sessions = [
      {
        id: 'ses-a',
        locationId: 'LOC-001',
        teacherId: teacher.userId,
      } as SessionEntity,
      {
        id: 'ses-b',
        locationId: 'LOC-001',
        teacherId: 'other-teacher',
      } as SessionEntity,
      {
        id: 'ses-c',
        locationId: 'LOC-002',
        teacherId: teacher.userId,
      } as SessionEntity,
    ];
    records = [
      {
        id: 'att-1',
        student: 'Chihea',
        studentId: 'SC-1001',
        sessionId: 'ses-a',
        session: 'SE401',
        location: 'Building A, Room 201',
        recordedAt: new Date('2026-08-14T09:15:00Z'),
        status: 'Present',
        distanceMeters: 12,
        latitude: 11.54795,
        longitude: 104.94061,
        scannedLocation:
          'Institute of Technology of Cambodia, Russian Federation Boulevard, Phnom Penh',
      } as AttendanceRecordEntity,
      {
        id: 'att-2',
        student: 'Sok Dara',
        studentId: 'SC-1024',
        sessionId: 'ses-b',
        session: 'SE302',
        location: 'Building A, Room 201',
        recordedAt: new Date('2026-08-14T10:05:00Z'),
        status: 'Outside Location',
        distanceMeters: 140,
        latitude: 11.6,
        longitude: 105.0,
      } as AttendanceRecordEntity,
      {
        id: 'att-3',
        student: 'Chihea',
        studentId: 'SC-1001',
        sessionId: 'ses-c',
        session: 'SE401 Lab',
        location: 'Building B, Room 105',
        recordedAt: new Date('2026-08-14T11:00:00Z'),
        status: 'Present',
        distanceMeters: 8,
        latitude: 11.54733,
        longitude: 104.93989,
      } as AttendanceRecordEntity,
    ];

    const locationRepo = {
      find: jest.fn(
        async (options?: {
          where?: { id?: unknown };
          order?: { id?: 'ASC' | 'DESC'; building?: 'ASC' | 'DESC' };
          select?: { building?: boolean };
        }) => {
          const ids = options?.where?.id
            ? extractInValues(options.where.id)
            : [];
          const rows =
            ids.length > 0
              ? store.filter((row) => ids.includes(row.id))
              : [...store];
          if (options?.order?.building) {
            return rows.sort((left, right) =>
              left.building.localeCompare(right.building),
            );
          }
          return rows.sort((left, right) => left.id.localeCompare(right.id));
        },
      ),
      findOne: jest.fn(async ({ where }: { where: { id: string } }) =>
        store.find((row) => row.id === where.id) ?? null,
      ),
      increment: jest.fn(
        async ({ id }: { id: string }, _field: string, value: number) => {
          const row = store.find((entry) => entry.id === id);
          if (row) {
            row.sessionsUsing += value;
          }
        },
      ),
      save: jest.fn(async (entity: LocationEntity) => {
        const index = store.findIndex((row) => row.id === entity.id);
        if (index >= 0) {
          store[index] = entity;
        }
        return entity;
      }),
    } as unknown as Repository<LocationEntity>;

    const sessionRepo = {
      find: jest.fn(
        async ({
          where,
        }: {
          where: { locationId?: string; teacherId?: string; id?: unknown };
        }) => {
          if (where.id != null) {
            const ids = extractInValues(where.id);
            return sessions.filter((session) => ids.includes(session.id));
          }
          return sessions.filter(
            (session) =>
              session.locationId === where.locationId &&
              (where.teacherId == null ||
                session.teacherId === where.teacherId),
          );
        },
      ),
    } as unknown as Repository<SessionEntity>;

    const recordRepo = {
      find: jest.fn(
        async ({
          where,
        }: {
          where: { sessionId: ReturnType<typeof Object> };
        }) => {
          const ids = extractInValues(where.sessionId);
          return records.filter((row) => ids.includes(row.sessionId));
        },
      ),
      createQueryBuilder: jest.fn(() => {
        let teacherId: string | undefined;
        let searchNeedle: string | undefined;
        let building: string | undefined;
        let status: string | undefined;
        let excludeStatus: string | undefined;

        const applyFilters = (): AttendanceRecordEntity[] => {
          return records
            .filter((row) => {
              const session = sessions.find(
                (entry) => entry.id === row.sessionId,
              );
              if (!session) {
                return false;
              }
              const location = store.find(
                (entry) => entry.id === session.locationId,
              );
              if (!location) {
                return false;
              }
              if (teacherId && session.teacherId !== teacherId) {
                return false;
              }
              if (building && location.building !== building) {
                return false;
              }
              if (excludeStatus && row.status === excludeStatus) {
                return false;
              }
              if (status && row.status !== status) {
                return false;
              }
              if (searchNeedle) {
                const haystack = [
                  row.student,
                  row.studentId,
                  row.location,
                  location.name,
                  location.id,
                  location.room,
                  location.building,
                ]
                  .join(' ')
                  .toLowerCase();
                if (!haystack.includes(searchNeedle.toLowerCase())) {
                  return false;
                }
              }
              return true;
            })
            .sort(
              (left, right) =>
                right.recordedAt.getTime() - left.recordedAt.getTime(),
            );
        };

        const qb = {
          innerJoin: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          andWhere: jest.fn(
            (_clause: string, params?: Record<string, string>) => {
              if (params?.teacherId) {
                teacherId = params.teacherId;
              }
              if (params?.building) {
                building = params.building;
              }
              if (params?.status) {
                status = params.status;
              }
              if (params?.absentStatus) {
                excludeStatus = params.absentStatus;
              }
              if (params?.needle) {
                searchNeedle = String(params.needle).replace(/%/g, '');
              }
              return qb;
            },
          ),
          getMany: jest.fn(async () => applyFilters()),
        };
        return qb;
      }),
    } as unknown as Repository<AttendanceRecordEntity>;

    service = new LocationsService(locationRepo, sessionRepo, recordRepo);
  });

  it('returns seeded campus locations', async () => {
    const locations = await service.findAll();
    expect(locations.length).toBeGreaterThanOrEqual(6);
    expect(locations.some((location) => location.id === 'LOC-001')).toBe(true);
  });

  it('returns a single location by id', async () => {
    const location = await service.findOne('LOC-001');
    expect(location.name).toContain('Building A');
    expect(location.building).toBe('Building A');
    expect(location.radiusMeters).toBe(80);
    expect(location.latitude).toBe(11.5479313);
    expect(location.longitude).toBe(104.9405941);
  });

  it('rejects unknown location ids', async () => {
    await expect(service.findOne('LOC-missing')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects inactive locations for session hosting', async () => {
    await expect(service.findActiveById('LOC-005')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('tracks sessionsUsing counters', async () => {
    await service.incrementSessionsUsing('LOC-001');
    expect((await service.findOne('LOC-001')).sessionsUsing).toBe(1);
    await service.decrementSessionsUsing('LOC-001');
    expect((await service.findOne('LOC-001')).sessionsUsing).toBe(0);
  });

  it('returns no visits when no student has scanned', async () => {
    records.length = 0;
    const page = await service.findVisits({}, teacher);
    expect(page.visits).toEqual([]);
    expect(page.metrics).toEqual({
      total: 0,
      present: 0,
      outsideLocation: 0,
    });
    expect(page.buildingOptions).toContain('Building A');
    expect(page.statusOptions).toEqual(['Present', 'Outside Location']);
  });

  it('lists student visits instead of the seeded zone catalog', async () => {
    const page = await service.findVisits({}, teacher);
    expect(page.visits).toHaveLength(2);
    expect(page.visits.map((visit) => visit.id).sort()).toEqual([
      'att-1',
      'att-3',
    ]);
    expect(page.visits.some((visit) => visit.locationId === 'LOC-001')).toBe(
      true,
    );
    const chihea = page.visits.find((visit) => visit.id === 'att-1');
    expect(chihea).toMatchObject({
      student: 'Chihea',
      studentId: 'SC-1001',
      locationName: 'Building A, Room 201',
      building: 'Building A',
      status: 'Present',
      latitude: 11.54795,
      longitude: 104.94061,
      scannedLocation:
        'Institute of Technology of Cambodia, Russian Federation Boulevard, Phnom Penh',
    });
    expect(page.metrics).toEqual({
      total: 2,
      present: 2,
      outsideLocation: 0,
    });
  });

  it('limits teacher visits to their own sessions', async () => {
    const page = await service.findVisits({}, teacher);
    expect(page.visits.map((visit) => visit.id).sort()).toEqual([
      'att-1',
      'att-3',
    ]);
    expect(page.metrics).toEqual({
      total: 2,
      present: 2,
      outsideLocation: 0,
    });
  });

  it('filters visits by search, building, and status in the query', async () => {
    const byName = await service.findVisits({ search: 'Chihea' }, teacher);
    expect(byName.visits.map((visit) => visit.id).sort()).toEqual([
      'att-1',
      'att-3',
    ]);

    const byRoom = await service.findVisits({ search: '201' }, teacher);
    expect(byRoom.visits.map((visit) => visit.id).sort()).toEqual([
      'att-1',
    ]);

    const byBuilding = await service.findVisits(
      { building: 'Building B' },
      teacher,
    );
    expect(byBuilding.visits).toHaveLength(1);
    expect(byBuilding.visits[0].id).toBe('att-3');
    expect(byBuilding.metrics.total).toBe(2);

    const byStatus = await service.findVisits(
      { status: 'Outside Location' },
      teacher,
    );
    expect(byStatus.visits).toHaveLength(0);
    expect(byStatus.metrics.outsideLocation).toBe(0);
  });

  it('excludes Absent attendance rows from the visit log', async () => {
    records.push({
      id: 'att-absent',
      student: 'Missing',
      studentId: 'SC-1099',
      sessionId: 'ses-a',
      session: 'SE401',
      location: 'Building A, Room 201',
      recordedAt: new Date('2026-08-14T12:00:00Z'),
      status: 'Absent',
      distanceMeters: null,
      latitude: null,
      longitude: null,
    } as AttendanceRecordEntity);

    const page = await service.findVisits({}, teacher);
    expect(page.visits.map((visit) => visit.id)).not.toContain('att-absent');
    expect(page.visits).toHaveLength(2);
  });

  it('exports filtered visits as an xlsx workbook with full scanned-at text', async () => {
    const now = new Date(2026, 7, 20, 12, 0, 0);
    const file = await service.exportVisitsExcel(
      { status: 'Present' },
      teacher,
      now,
    );

    expect(file.filename).toBe('location-visits-2026-08-20.xlsx');
    expect(file.buffer.subarray(0, 2).toString()).toBe('PK');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer);
    const sheet = workbook.getWorksheet('Location visits');
    expect(sheet).toBeDefined();
    expect(sheet?.getRow(1).getCell(1).value).toBe('Student');
    const headers: string[] = [];
    sheet?.getRow(1).eachCell((cell) => headers.push(String(cell.value ?? '')));
    expect(headers).not.toContain('GPS accuracy (m)');
    expect(sheet?.rowCount).toBeGreaterThan(1);
    const scannedAtValues: string[] = [];
    sheet?.eachRow((row, index) => {
      if (index > 1) {
        scannedAtValues.push(String(row.getCell(7).value ?? ''));
      }
    });
    expect(
      scannedAtValues.some((value) =>
        value.includes('Institute of Technology of Cambodia'),
      ),
    ).toBe(true);
    expect(workbook.getWorksheet('Summary')).toBeDefined();
  });
});

function extractInValues(operator: unknown): string[] {
  if (operator && typeof operator === 'object') {
    const value = (operator as { _value?: unknown; value?: unknown })._value
      ?? (operator as { value?: unknown }).value;
    if (Array.isArray(value)) {
      return value as string[];
    }
  }
  return [];
}

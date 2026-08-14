import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  ATTENDANCE_STATUS,
  AttendanceStatus,
} from '../../common/constants/status.constant';
import { USER_ROLES } from '../../common/constants/roles.constant';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { toIsoDate } from '../../common/utils/date.util';
import { AttendanceRecordEntity } from '../../database/entities/attendance-record.entity';
import { LocationEntity } from '../../database/entities/location.entity';
import { SessionEntity } from '../../database/entities/session.entity';
import { CampusLocationResponseDto } from './dto/location-response.dto';
import { LocationVisitFilterDto } from './dto/location-visit-filter.dto';
import {
  LocationVisitMetricsDto,
  LocationVisitPageResponseDto,
  LocationVisitResponseDto,
} from './dto/location-visit-response.dto';

/** Statuses a student scan / mark-present can produce on this page. */
const VISIT_STATUS_OPTIONS: AttendanceStatus[] = [
  ATTENDANCE_STATUS.present,
  ATTENDANCE_STATUS.outsideLocation,
];

/**
 * Campus locations persisted in MySQL.
 */
@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(LocationEntity)
    private readonly locations: Repository<LocationEntity>,
    @InjectRepository(SessionEntity)
    private readonly sessions: Repository<SessionEntity>,
    @InjectRepository(AttendanceRecordEntity)
    private readonly records: Repository<AttendanceRecordEntity>,
  ) {}

  async findAll(): Promise<CampusLocationResponseDto[]> {
    const rows = await this.locations.find({ order: { id: 'ASC' } });
    return rows.map((row) => this.toResponse(row));
  }

  async findOne(id: string): Promise<CampusLocationResponseDto> {
    const location = await this.locations.findOne({ where: { id } });
    if (!location) {
      throw new NotFoundException(`Location ${id} not found`);
    }
    return this.toResponse(location);
  }

  /** Active zones only — used when creating attendance sessions. */
  async findActiveById(id: string): Promise<CampusLocationResponseDto> {
    const location = await this.findOne(id);
    if (location.status !== 'Active') {
      throw new NotFoundException(
        `Location ${id} is not Active and cannot host a session`,
      );
    }
    return location;
  }

  async incrementSessionsUsing(locationId: string): Promise<void> {
    await this.locations.increment({ id: locationId }, 'sessionsUsing', 1);
  }

  async decrementSessionsUsing(locationId: string): Promise<void> {
    const location = await this.locations.findOne({ where: { id: locationId } });
    if (location && location.sessionsUsing > 0) {
      location.sessionsUsing -= 1;
      await this.locations.save(location);
    }
  }

  /**
   * Student visit log for the Locations page.
   * Rows come from attendance_records (QR / Mark present), joined to the
   * session's campus zone for building / area name. Filters run in SQL.
   * Metrics and building options ignore the current filter so cards and
   * dropdowns stay stable when Apply narrows the table.
   */
  async findVisits(
    dto: LocationVisitFilterDto,
    actor: AuthenticatedUser,
  ): Promise<LocationVisitPageResponseDto> {
    const filtered = await this.loadVisitRecords(actor, dto);
    const unfiltered = await this.loadVisitRecords(actor, {});

    return {
      visits: await this.toVisitResponses(filtered),
      metrics: this.buildVisitMetrics(unfiltered),
      buildingOptions: await this.listBuildingOptions(),
      statusOptions: VISIT_STATUS_OPTIONS,
    };
  }

  private async loadVisitRecords(
    actor: AuthenticatedUser,
    dto: LocationVisitFilterDto,
  ): Promise<AttendanceRecordEntity[]> {
    const qb = this.records
      .createQueryBuilder('record')
      .innerJoin(SessionEntity, 'session', 'session.id = record.session_id')
      .innerJoin(
        LocationEntity,
        'location',
        'location.id = session.location_id',
      )
      .orderBy('record.recorded_at', 'DESC');

    if (dto.search?.trim()) {
      const needle = `%${dto.search.trim()}%`;
      qb.andWhere(
        '(record.student LIKE :needle OR record.student_id LIKE :needle OR record.location LIKE :needle OR location.name LIKE :needle OR location.id LIKE :needle OR location.room LIKE :needle OR location.building LIKE :needle)',
        { needle },
      );
    }

    if (dto.building?.trim()) {
      qb.andWhere('location.building = :building', {
        building: dto.building.trim(),
      });
    }

    if (dto.status) {
      qb.andWhere('record.status = :status', { status: dto.status });
    }

    if (actor.role === USER_ROLES.teacher) {
      qb.andWhere('session.teacher_id = :teacherId', {
        teacherId: actor.userId,
      });
    }

    return qb.getMany();
  }

  private async toVisitResponses(
    rows: AttendanceRecordEntity[],
  ): Promise<LocationVisitResponseDto[]> {
    if (rows.length === 0) {
      return [];
    }

    const sessionIds = [...new Set(rows.map((row) => row.sessionId))];
    const sessionRows = await this.sessions.find({
      where: { id: In(sessionIds) },
    });
    const sessionsById = new Map(
      sessionRows.map((session) => [session.id, session] as const),
    );

    const locationIds = [
      ...new Set(sessionRows.map((session) => session.locationId)),
    ];
    const locationRows =
      locationIds.length > 0
        ? await this.locations.find({ where: { id: In(locationIds) } })
        : [];
    const locationsById = new Map(
      locationRows.map((location) => [location.id, location] as const),
    );

    return rows.flatMap((row) => {
      const session = sessionsById.get(row.sessionId);
      if (!session) {
        return [];
      }
      const location = locationsById.get(session.locationId);
      if (!location) {
        return [];
      }
      return [this.toVisitResponse(row, session, location)];
    });
  }

  private toVisitResponse(
    row: AttendanceRecordEntity,
    session: SessionEntity,
    location: LocationEntity,
  ): LocationVisitResponseDto {
    return {
      id: row.id,
      student: row.student,
      studentId: row.studentId,
      locationId: location.id,
      locationName: location.name,
      building: location.building,
      room: location.room,
      session: row.session,
      sessionId: row.sessionId,
      status: row.status as AttendanceStatus,
      recordedAt: toIsoDate(row.recordedAt),
      distanceMeters: row.distanceMeters,
      latitude: row.latitude ?? null,
      longitude: row.longitude ?? null,
      scannedLocation: row.scannedLocation ?? null,
    };
  }

  private buildVisitMetrics(
    rows: AttendanceRecordEntity[],
  ): LocationVisitMetricsDto {
    return {
      total: rows.length,
      present: rows.filter((row) => row.status === ATTENDANCE_STATUS.present)
        .length,
      outsideLocation: rows.filter(
        (row) => row.status === ATTENDANCE_STATUS.outsideLocation,
      ).length,
    };
  }

  private async listBuildingOptions(): Promise<string[]> {
    const rows = await this.locations.find({
      select: { building: true },
      order: { building: 'ASC' },
    });
    return [
      ...new Set(rows.map((row) => row.building).filter(Boolean)),
    ].sort((left, right) => left.localeCompare(right));
  }

  private toResponse(location: LocationEntity): CampusLocationResponseDto {
    return {
      id: location.id,
      name: location.name,
      building: location.building,
      room: location.room,
      radiusMeters: location.radiusMeters,
      latitude: location.latitude,
      longitude: location.longitude,
      status: location.status as CampusLocationResponseDto['status'],
      sessionsUsing: location.sessionsUsing,
    };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LocationEntity } from '../../database/entities/location.entity';
import { CampusLocationResponseDto } from './dto/location-response.dto';

/**
 * Campus locations persisted in MySQL.
 */
@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(LocationEntity)
    private readonly locations: Repository<LocationEntity>,
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

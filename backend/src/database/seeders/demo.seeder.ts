import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { USER_ROLES } from '../../common/constants/roles.constant';
import { hashPassword } from '../../common/utils/password.util';
import { LOCATION_SEED } from '../../modules/locations/data/locations.seed';
import { LocationEntity } from '../entities/location.entity';
import { UserEntity } from '../entities/user.entity';


@Injectable()
export class DemoSeeder implements OnModuleInit {
  private readonly logger = new Logger(DemoSeeder.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(LocationEntity)
    private readonly locations: Repository<LocationEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedTeacher();
    await this.seedLocations();
    this.logger.log('Seed completed (teacher, locations)');
  }

  private async seedTeacher(): Promise<void> {
    const teacher = {
      id: 'u-teacher-1',
      name: 'Teacher Kim',
      email: 'teacher@smartcampus.edu',
      password: 'teacher123',
    };

    const existing = await this.users.findOne({ where: { id: teacher.id } });
    if (existing) {
      return;
    }

    await this.users.save(
      this.users.create({
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        passwordHash: hashPassword(teacher.password),
        role: USER_ROLES.teacher,
        studentId: null,
      }),
    );

  }

  private async seedLocations(): Promise<void> {
  

    for (const seed of LOCATION_SEED) {
      const existing = await this.locations.findOne({ where: { id: seed.id } });
      if (existing) {
        existing.name = seed.name;
        existing.building = seed.building;
        existing.room = seed.room;
        existing.radiusMeters = seed.radiusMeters;
        existing.latitude = seed.latitude;
        existing.longitude = seed.longitude;
        existing.status = seed.status;
        await this.locations.save(existing);
        continue;
      }
      await this.locations.save(
        this.locations.create({
          id: seed.id,
          name: seed.name,
          building: seed.building,
          room: seed.room,
          radiusMeters: seed.radiusMeters,
          latitude: seed.latitude,
          longitude: seed.longitude,
          status: seed.status,
          sessionsUsing: 0,
        }),
      );
    }
  }

}
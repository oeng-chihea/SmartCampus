import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { USER_ROLES } from '../../common/constants/roles.constant';
import { hashPassword } from '../../common/utils/password.util';
import { LOCATION_SEED } from '../../modules/locations/data/locations.seed';
import { LocationEntity } from '../entities/location.entity';
import { StudentEntity } from '../entities/student.entity';
import { UserEntity } from '../entities/user.entity';

/**
 * Idempotent demo rows so login + locations work after a fresh schema sync.
 * Safe to run on every boot: skips existing primary keys.
 */
@Injectable()
export class DemoSeeder implements OnModuleInit {
  private readonly logger = new Logger(DemoSeeder.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(StudentEntity)
    private readonly students: Repository<StudentEntity>,
    @InjectRepository(LocationEntity)
    private readonly locations: Repository<LocationEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedUsers();
    await this.seedStudents();
    await this.seedLocations();
    this.logger.log('Demo seed completed (users, students, locations)');
  }

  private async seedUsers(): Promise<void> {
    const demos: Array<{
      id: string;
      name: string;
      email: string;
      password: string;
      role: string;
      studentId: string | null;
    }> = [
      {
        id: 'u-admin-1',
        name: 'System Admin',
        email: 'admin@smartcampus.edu',
        password: 'admin123',
        role: USER_ROLES.admin,
        studentId: null,
      },
      {
        id: 'u-teacher-1',
        name: 'Teacher Kim',
        email: 'teacher@smartcampus.edu',
        password: 'teacher123',
        role: USER_ROLES.teacher,
        studentId: null,
      },
      {
        id: 'u-student-1',
        name: 'Sok Dara',
        email: 'student@smartcampus.edu',
        password: 'student123',
        role: USER_ROLES.student,
        studentId: 'SC-1024',
      },
    ];

    for (const demo of demos) {
      const existing = await this.users.findOne({ where: { id: demo.id } });
      if (existing) {
        continue;
      }

      await this.users.save(
        this.users.create({
          id: demo.id,
          name: demo.name,
          email: demo.email,
          passwordHash: hashPassword(demo.password),
          role: demo.role,
          studentId: demo.studentId,
        }),
      );
    }
  }

  private async seedStudents(): Promise<void> {
    const rows: Array<Partial<StudentEntity>> = [
      {
        studentId: 'SC-1024',
        name: 'Sok Dara',
        email: 'sok.dara@smartcampus.edu',
        course: 'SE401',
        year: 'Year 3',
        attendanceRate: 94,
        status: 'Active',
        loginEnabled: true,
        userId: 'u-student-1',
      },
      {
        studentId: 'SC-1088',
        name: 'Maly Chan',
        email: 'maly.chan@smartcampus.edu',
        course: 'SE401',
        year: 'Year 2',
        attendanceRate: 87,
        status: 'Review',
        loginEnabled: true,
        userId: null,
      },
      {
        studentId: 'SC-1132',
        name: 'Rithy Kun',
        email: 'rithy.kun@smartcampus.edu',
        course: 'SE302',
        year: 'Year 4',
        attendanceRate: 91,
        status: 'Active',
        loginEnabled: true,
        userId: null,
      },
      {
        studentId: 'SC-1196',
        name: 'Nita Lim',
        email: 'nita.lim@smartcampus.edu',
        course: 'CS201',
        year: 'Year 1',
        attendanceRate: 72,
        status: 'Review',
        loginEnabled: false,
        userId: null,
      },
      {
        studentId: 'SC-1201',
        name: 'Vannak Sok',
        email: 'vannak.sok@smartcampus.edu',
        course: 'SE401',
        year: 'Year 3',
        attendanceRate: 96,
        status: 'Active',
        loginEnabled: true,
        userId: null,
      },
    ];

    for (const row of rows) {
      const existing = await this.students.findOne({
        where: { studentId: row.studentId as string },
      });
      if (existing) {
        continue;
      }
      await this.students.save(this.students.create(row));
    }
  }

  private async seedLocations(): Promise<void> {
    for (const seed of LOCATION_SEED) {
      const existing = await this.locations.findOne({ where: { id: seed.id } });
      if (existing) {
        // Keep counters; refresh display fields so Building A/B/C stay current.
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

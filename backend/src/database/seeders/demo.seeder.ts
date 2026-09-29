import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { USER_ROLES } from '../../common/constants/roles.constant';
import { hashPassword } from '../../common/utils/password.util';
import { LOCATION_SEED } from '../../modules/locations/data/locations.seed';
import { LocationEntity } from '../entities/location.entity';
import { StudentEntity } from '../entities/student.entity';
import { UserEntity } from '../entities/user.entity';

/**
 * Idempotent seed rows so login + locations work after a fresh schema sync.
 * Safe to run on every boot: updates seeded rows and preserves counters.
 *
 * Student login accounts are NOT demo data — only the initial student
 * (Chihea) is seeded. Every other student account is created by a teacher
 * through the real `POST /students` flow.
 */
@Injectable()
export class DemoSeeder implements OnModuleInit {
  private readonly logger = new Logger(DemoSeeder.name);

  /** Legacy demo student login accounts (removed from the real flow). */
  private readonly LEGACY_STUDENT_USER_IDS = [
    'u-student-1',
    'u-student-2',
    'u-student-3',
    'u-student-4',
  ];

  /** Legacy demo student profiles (superseded by the initial Chihea seed). */
  private readonly LEGACY_STUDENT_PROFILE_IDS = [
    'SC-1024',
    'SC-1088',
    'SC-1132',
    'SC-1196',
    'SC-1201',
  ];

  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(StudentEntity)
    private readonly students: Repository<StudentEntity>,
    @InjectRepository(LocationEntity)
    private readonly locations: Repository<LocationEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.removeLegacyDemoStudents();
    await this.removeLegacyAdmin();
    await this.seedUsers();
    await this.seedStudents();
    await this.seedLocations();
    this.logger.log('Seed completed (users, students, locations)');
  }

  /** Remove the retired admin role and its seeded account. */
  private async removeLegacyAdmin(): Promise<void> {
    const leftover = await this.users.find({
      where: [{ id: 'u-admin-1' }, { email: 'admin@smartcampus.edu' }],
    });
    if (leftover.length) {
      await this.users.remove(leftover);
      this.logger.log(`Removed ${leftover.length} legacy admin account(s)`);
    }

    const leftoverAdmins = await this.users.find({ where: { role: 'admin' } });
    if (leftoverAdmins.length) {
      for (const row of leftoverAdmins) {
        row.role = USER_ROLES.teacher;
      }
      await this.users.save(leftoverAdmins);
      this.logger.log(
        `Converted ${leftoverAdmins.length} leftover admin role(s) to teacher`,
      );
    }
  }

  /** Delete leftover demo student accounts/profiles from earlier seeds. */
  private async removeLegacyDemoStudents(): Promise<void> {
    const users = await this.users.find({
      where: { id: In(this.LEGACY_STUDENT_USER_IDS) },
    });
    if (users.length) {
      await this.users.remove(users);
      this.logger.log(`Removed ${users.length} legacy demo student account(s)`);
    }

    const profiles = await this.students.find({
      where: { studentId: In(this.LEGACY_STUDENT_PROFILE_IDS) },
    });
    if (profiles.length) {
      await this.students.remove(profiles);
      this.logger.log(
        `Removed ${profiles.length} legacy demo student profile(s)`,
      );
    }
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
        id: 'u-teacher-1',
        name: 'Teacher Kim',
        email: 'teacher@smartcampus.edu',
        password: 'teacher123',
        role: USER_ROLES.teacher,
        studentId: null,
      },
      {
        id: 'u-chihea',
        name: 'Chihea',
        email: 'chihea@smartcampus.edu',
        password: 'chihea123',
        role: USER_ROLES.student,
        studentId: 'SC-1001',
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
        studentId: 'SC-1001',
        name: 'Chihea',
        email: 'chihea@smartcampus.edu',
        course: 'SE401',
        year: 'Year 1',
        attendanceRate: 100,
        status: 'Active',
        loginEnabled: true,
        userId: 'u-chihea',
      },
    ];

    for (const row of rows) {
      const existing = await this.students.findOne({
        where: { studentId: row.studentId as string },
      });
      if (existing) {
        // Backfill the user-account link when the account is added later.
        if (existing.userId !== row.userId) {
          existing.userId = row.userId ?? existing.userId;
          await this.students.save(existing);
        }
        continue;
      }
      await this.students.save(this.students.create(row));
    }
  }

  private async seedLocations(): Promise<void> {
    await this.deactivateStaleSeedLocations();

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

  /**
   * Keep retired seed rows available for historical sessions without exposing
   * them as selectable locations for new sessions.
   */
  private async deactivateStaleSeedLocations(): Promise<void> {
    const currentSeedIds = new Set(LOCATION_SEED.map((seed) => seed.id));
    const staleRows = (await this.locations.find()).filter(
      (location) =>
        location.id.startsWith('LOC-') && !currentSeedIds.has(location.id),
    );

    if (staleRows.length === 0) {
      return;
    }

    for (const row of staleRows) {
      row.status = 'Inactive';
    }
    await this.locations.save(staleRows);
    this.logger.log(
      `Deactivated ${staleRows.length} retired campus location seed(s)`,
    );
  }
}

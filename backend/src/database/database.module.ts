import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AttendanceRecordEntity,
  LocationEntity,
  SessionEntity,
  StudentEntity,
  UserEntity,
} from './entities';
import { DemoSeeder } from './seeders/demo.seeder';

/**
 * Shared TypeORM feature registration + demo seeder for app boot.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      StudentEntity,
      LocationEntity,
      SessionEntity,
      AttendanceRecordEntity,
    ]),
  ],
  providers: [DemoSeeder],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}

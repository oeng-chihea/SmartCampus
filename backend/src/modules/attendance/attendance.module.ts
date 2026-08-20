import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceRecordEntity } from '../../database/entities/attendance-record.entity';
import { SessionEntity } from '../../database/entities/session.entity';
import { StudentEntity } from '../../database/entities/student.entity';
import { AuthModule } from '../auth/auth.module';
import { LocationsModule } from '../locations/locations.module';
import { SessionsModule } from '../sessions/sessions.module';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { ReverseGeocodeService } from './reverse-geocode.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AttendanceRecordEntity,
      SessionEntity,
      StudentEntity,
    ]),
    AuthModule,
    SessionsModule,
    LocationsModule,
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService, ReverseGeocodeService],
  exports: [AttendanceService],
})
export class AttendanceModule {}

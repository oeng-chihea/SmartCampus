import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceRecordEntity } from '../../database/entities/attendance-record.entity';
import { SessionEntity } from '../../database/entities/session.entity';
import { AuthModule } from '../auth/auth.module';
import { LocationsModule } from '../locations/locations.module';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SessionEntity, AttendanceRecordEntity]),
    AuthModule,
    LocationsModule,
  ],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}

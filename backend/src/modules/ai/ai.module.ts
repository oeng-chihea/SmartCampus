import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { AuthModule } from '../auth/auth.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { LocationsModule } from '../locations/locations.module';
import { SessionsModule } from '../sessions/sessions.module';
import { StudentsModule } from '../students/students.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { CampusVoiceSnapshotService } from './campus-voice.snapshot.service';

@Module({
  imports: [
    AuthModule,
    AttendanceModule,
    DashboardModule,
    LocationsModule,
    SessionsModule,
    StudentsModule,
  ],
  controllers: [AiController],
  providers: [AiService, CampusVoiceSnapshotService],
})
export class AiModule {}

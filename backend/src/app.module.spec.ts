import { AppModule } from './app.module';
import { AiModule } from './modules/ai/ai.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { LocationsModule } from './modules/locations/locations.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { StudentsModule } from './modules/students/students.module';
import { UsersModule } from './modules/users/users.module';

describe('AppModule', () => {
  it('registers every frontend-aligned feature module', () => {
    const imports = Reflect.getMetadata('imports', AppModule) as unknown[];
    const resolved = (imports ?? []).map((entry) => {
      if (typeof entry === 'function') {
        return entry;
      }
      return entry;
    });

    const featureModules = [
      AuthModule,
      AiModule,
      UsersModule,
      StudentsModule,
      DashboardModule,
      AttendanceModule,
      LocationsModule,
      SessionsModule,
      ReportsModule,
    ];

    for (const feature of featureModules) {
      expect(resolved).toContain(feature);
    }
  });
});

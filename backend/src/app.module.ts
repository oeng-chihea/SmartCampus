import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import geminiConfig from './config/gemini.config';
import jwtConfig from './config/jwt.config';
import { ALL_ENTITIES } from './database/entities';
import { DatabaseModule } from './database/database.module';
import { AiModule } from './modules/ai/ai.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { LocationsModule } from './modules/locations/locations.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { StudentsModule } from './modules/students/students.module';
import { UsersModule } from './modules/users/users.module';

/** Resolve .env whether started from repo root or backend/ */
const envFilePath = [
  join(process.cwd(), '.env'),
  join(process.cwd(), 'backend', '.env'),
  join(__dirname, '..', '.env'),
];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath,
      load: [appConfig, databaseConfig, jwtConfig, geminiConfig],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql' as const,
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.database'),
        entities: [...ALL_ENTITIES],
        synchronize: config.get<boolean>('database.synchronize') ?? true,
        autoLoadEntities: true,
      }),
    }),
    DatabaseModule,
    AuthModule,
    AiModule,
    UsersModule,
    StudentsModule,
    DashboardModule,
    AttendanceModule,
    LocationsModule,
    SessionsModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PasswordResetTokenEntity } from '../../database/entities/password-reset-token.entity';
import { MailModule } from '../mail/mail.module';
import { StudentsModule } from '../students/students.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PasswordResetTokenEntity]),
    forwardRef(() => UsersModule),
    StudentsModule,
    MailModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, RolesGuard],
  exports: [AuthService, AuthGuard, RolesGuard],
})
export class AuthModule {}

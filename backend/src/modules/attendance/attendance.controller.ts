import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { USER_ROLES } from '../../common/constants/roles.constant';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AttendanceService } from './attendance.service';
import { SubmitAttendanceDto } from './dto/submit-attendance.dto';

@Controller('attendance')
@UseGuards(AuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  /**
   * Validate QR and return session title/location without recording.
   * Used after the student scans the teacher QR.
   */
  @Post('preview')
  @Roles(USER_ROLES.student)
  preview(
    @Body() body: SubmitAttendanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendanceService.preview(body, user);
  }

  /**
   * Student scan submit — validates open session + live QR payload.
   */
  @Post('submit')
  @Roles(USER_ROLES.student)
  submit(
    @Body() body: SubmitAttendanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendanceService.submit(body, user);
  }

  /** Authenticated student's own scan history (this server run). */
  @Get('me')
  @Roles(USER_ROLES.student)
  findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.attendanceService.findMine(user);
  }
}

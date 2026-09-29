import {
  Body,
  Controller,
  Get,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { USER_ROLES } from '../../common/constants/roles.constant';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { sendExcelFile } from '../../common/utils/excel-response';
import { AttendanceService } from './attendance.service';
import { AdminAttendanceFilterDto } from './dto/admin-attendance-filter.dto';
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

  /**
   * Admin/teacher attendance log — server-side search, session, status,
   * and date filters. Filters arrive as a JSON body so the exact request
   * is easy to inspect; date ranges are resolved on the database.
   */
  @Post('admin')
  @Roles(USER_ROLES.teacher)
  findAdmin(
    @Body() body: AdminAttendanceFilterDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendanceService.findAdminRecords(body, user);
  }

  /**
   * Excel download of the admin/teacher attendance log.
   * Body is the same filter payload as POST /attendance/admin.
   */
  @Post('admin/excel')
  @Roles(USER_ROLES.teacher)
  async exportAdminExcel(
    @Body() body: AdminAttendanceFilterDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    sendExcelFile(
      res,
      await this.attendanceService.exportAdminExcel(body ?? {}, user),
    );
  }
}

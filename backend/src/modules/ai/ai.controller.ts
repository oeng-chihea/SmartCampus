import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { USER_ROLES } from '../../common/constants/roles.constant';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AiService } from './ai.service';
import { CampusRecordsQueryDto } from './dto/campus-records-query.dto';
import { CreateLiveTokenDto } from './dto/create-live-token.dto';

@Controller('ai')
@UseGuards(AuthGuard, RolesGuard)
@Roles(USER_ROLES.teacher, USER_ROLES.student)
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('live-token')
  createLiveToken(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateLiveTokenDto,
  ) {
    return this.ai.createLiveToken(user, body ?? {});
  }

  /** Unfiltered campus records for the signed-in teacher. */
  @Get('campus-records')
  readAllCampusRecords(@CurrentUser() user: AuthenticatedUser) {
    return this.ai.readCampusRecords(user, {});
  }

  /**
   * Live campus records for English voice.
   * Empty body = every record with names, buildings, distances, dues,
   * and login fields. Filters apply when the user asked to limit the data.
   */
  @Post('campus-records')
  readCampusRecords(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CampusRecordsQueryDto,
  ) {
    return this.ai.readCampusRecords(user, body ?? {});
  }
}

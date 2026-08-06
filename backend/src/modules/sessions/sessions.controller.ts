import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { USER_ROLES } from '../../common/constants/roles.constant';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateSessionDto } from './dto/create-session.dto';
import { SessionsService } from './sessions.service';

@Controller('sessions')
@UseGuards(AuthGuard, RolesGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  @Roles(USER_ROLES.admin, USER_ROLES.teacher)
  create(
    @Body() body: CreateSessionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessionsService.create(body, user);
  }

  @Get()
  @Roles(USER_ROLES.admin, USER_ROLES.teacher)
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.findAll(user);
  }

  /**
   * Live open sessions + current QR for teacher and student apps.
   * Must stay above :id routes.
   */
  @Get('open')
  @Roles(USER_ROLES.admin, USER_ROLES.teacher, USER_ROLES.student)
  listOpenLive() {
    return this.sessionsService.listOpenLive();
  }

  @Get(':id')
  @Roles(USER_ROLES.admin, USER_ROLES.teacher)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.findOne(id, user);
  }

  @Get(':id/qr')
  @Roles(USER_ROLES.admin, USER_ROLES.teacher)
  getQr(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.getQr(id, user);
  }

  @Post(':id/close')
  @Roles(USER_ROLES.admin, USER_ROLES.teacher)
  close(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.close(id, user);
  }
}

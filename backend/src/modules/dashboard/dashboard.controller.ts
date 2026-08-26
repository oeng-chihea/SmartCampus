import { Controller, Get, UseGuards } from '@nestjs/common';
import { USER_ROLES } from '../../common/constants/roles.constant';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(AuthGuard, RolesGuard)
@Roles(USER_ROLES.teacher)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  getAdminDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboard.getAdminDashboard(user);
  }
}

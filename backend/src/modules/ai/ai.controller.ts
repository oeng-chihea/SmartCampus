import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { USER_ROLES } from '../../common/constants/roles.constant';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AiService } from './ai.service';
import { CreateLiveTokenDto } from './dto/create-live-token.dto';

@Controller('ai')
@UseGuards(AuthGuard, RolesGuard)
@Roles(USER_ROLES.admin, USER_ROLES.teacher)
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('live-token')
  createLiveToken(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateLiveTokenDto,
  ) {
    return this.ai.createLiveToken(user, body ?? {});
  }
}

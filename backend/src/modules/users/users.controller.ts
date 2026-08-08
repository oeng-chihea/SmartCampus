import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { USER_ROLES } from '../../common/constants/roles.constant';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(AuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** Provision a login account (admin/teacher/student). Admin only. */
  @Post()
  @Roles(USER_ROLES.admin)
  create(@Body() dto: CreateUserDto) {
    return this.usersService.createUser(dto);
  }
}

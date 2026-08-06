import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { USER_ROLES } from '../../common/constants/roles.constant';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { LocationsService } from './locations.service';

@Controller('locations')
@UseGuards(AuthGuard, RolesGuard)
@Roles(USER_ROLES.admin, USER_ROLES.teacher, USER_ROLES.student)
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  findAll() {
    return this.locationsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.locationsService.findOne(id);
  }
}

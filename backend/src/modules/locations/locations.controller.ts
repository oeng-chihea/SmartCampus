import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { USER_ROLES } from '../../common/constants/roles.constant';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { LocationVisitFilterDto } from './dto/location-visit-filter.dto';
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

  /**
   * Student visit log for the Locations page.
   * Filters are applied in SQL — search, building, and status are not
   * client-side only. Catalog `GET /locations` stays unchanged for
   * session create + geofence.
   */
  @Post('visits')
  @Roles(USER_ROLES.admin, USER_ROLES.teacher)
  findVisits(
    @Body() body: LocationVisitFilterDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.locationsService.findVisits(body ?? {}, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.locationsService.findOne(id);
  }
}

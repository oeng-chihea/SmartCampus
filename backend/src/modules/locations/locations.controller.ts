import {
  Body,
  Controller,
  Get,
  Param,
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
import { LocationVisitFilterDto } from './dto/location-visit-filter.dto';
import { LocationsService } from './locations.service';

@Controller('locations')
@UseGuards(AuthGuard, RolesGuard)
@Roles(USER_ROLES.teacher, USER_ROLES.student)
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
  @Roles(USER_ROLES.teacher)
  findVisits(
    @Body() body: LocationVisitFilterDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.locationsService.findVisits(body ?? {}, user);
  }

  /**
   * Excel download of the student visit log.
   * Body is the same filter payload as POST /locations/visits.
   */
  @Post('visits/excel')
  @Roles(USER_ROLES.teacher)
  async exportVisitsExcel(
    @Body() body: LocationVisitFilterDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    sendExcelFile(
      res,
      await this.locationsService.exportVisitsExcel(body ?? {}, user),
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.locationsService.findOne(id);
  }
}

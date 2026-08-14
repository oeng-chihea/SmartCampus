import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ATTENDANCE_STATUS } from '../../../common/constants/status.constant';

/**
 * Filter payload for POST /locations/visits.
 * JSON body (not query params) so the Network panel shows the exact
 * search / building / status fields the Locations page applied.
 */
export class LocationVisitFilterDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  building?: string;

  @IsOptional()
  @IsIn(Object.values(ATTENDANCE_STATUS))
  status?: string;
}

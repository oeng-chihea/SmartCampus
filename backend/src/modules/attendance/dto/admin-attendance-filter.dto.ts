import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ATTENDANCE_STATUS } from '../../../common/constants/status.constant';

/**
 * Filter payload for POST /attendance/admin.
 * Sent as a JSON body (not query params) so callers can inspect the exact
 * API request and filter fields in the network panel.
 * Date filtering happens server-side (fast indexed range on recorded_at)
 * instead of shipping every row to the client.
 */
export class AdminAttendanceFilterDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sessionId?: string;

  @IsOptional()
  @IsIn(Object.values(ATTENDANCE_STATUS))
  status?: string;

  @IsOptional()
  @IsIn(['today', 'yesterday', 'week'])
  date?: 'today' | 'yesterday' | 'week';
}

import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  ADMIN_ATTENDANCE_STATUS_FILTERS,
  ADMIN_LOCATION_STATUS_FILTERS,
} from '../../../common/constants/status.constant';

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

  /** Geofence: inside (Present) or outside (Outside Location). */
  @IsOptional()
  @IsIn([...ADMIN_LOCATION_STATUS_FILTERS])
  status?: (typeof ADMIN_LOCATION_STATUS_FILTERS)[number];

  /** Check-in: Present (scanned) or Absent (no scan). */
  @IsOptional()
  @IsIn([...ADMIN_ATTENDANCE_STATUS_FILTERS])
  attendanceStatus?: (typeof ADMIN_ATTENDANCE_STATUS_FILTERS)[number];

  @IsOptional()
  @IsIn(['today', 'yesterday', 'week'])
  date?: 'today' | 'yesterday' | 'week';
}

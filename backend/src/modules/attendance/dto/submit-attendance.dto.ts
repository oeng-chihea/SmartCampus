import { Type } from 'class-transformer';
import {
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Student submits the full QR payload from the teacher screen, plus an
 * optional device GPS fix for the geofence check (FR-02).
 * Format: SMARTCAMPUS|<sessionId>|<token>
 */
export class SubmitAttendanceDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(200)
  payload!: string;

  /**
   * Device coordinates at submit time. Marked `@IsOptional` only so the
   * DTO still validates the *format* when a value is sent — presence is a
   * hard business rule enforced in `AttendanceService.requireCoordinates`
   * (FR-02): a request with no coordinates at all is rejected with a clear
   * "allow location" message instead of a generic validation error.
   */
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  /** Horizontal GPS accuracy from the browser. Stored with the scan. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(50_000)
  accuracyMeters?: number;
}

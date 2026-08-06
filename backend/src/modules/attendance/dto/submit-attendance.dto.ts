import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Student submits the full QR payload from the teacher screen.
 * Format: SMARTCAMPUS|<sessionId>|<token>
 */
export class SubmitAttendanceDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(200)
  payload!: string;
}

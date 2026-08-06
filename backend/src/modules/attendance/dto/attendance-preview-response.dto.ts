/**
 * Session snapshot for the student scan page after QR decode.
 * Does not create an attendance record.
 */
export interface AttendancePreviewResponseDto {
  sessionId: string;
  title: string;
  locationName: string;
  lateAfterMinutes: number;
  /** True when this student already has a record for the session. */
  alreadySubmitted: boolean;
}

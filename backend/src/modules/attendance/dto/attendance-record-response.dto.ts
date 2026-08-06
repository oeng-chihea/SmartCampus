import { AttendanceStatus } from '../../../common/constants/status.constant';

export interface AttendanceRecordResponseDto {
  id: string;
  student: string;
  studentId: string;
  session: string;
  location: string;
  recordedAt: string;
  submittedAt: string;
  status: AttendanceStatus;
  /** Reserved for GPS phase — null until location validation lands. */
  distanceMeters: number | null;
}

import { AttendanceStatus } from '../../../common/constants/status.constant';
import { AttendanceRecordResponseDto } from './attendance-record-response.dto';

export interface AdminAttendanceMetricsDto {
  present: number;
  late: number;
  absent: number;
}

export interface AdminAttendanceResponseDto {
  records: AttendanceRecordResponseDto[];
  metrics: AdminAttendanceMetricsDto;
  /** Real statuses present in the data (stable canonical order). */
  statusOptions: AttendanceStatus[];
}

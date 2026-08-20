import { AttendanceStatus } from '../../../common/constants/status.constant';
import { AttendanceRecordResponseDto } from './attendance-record-response.dto';

export interface AdminAttendanceMetricsDto {
  present: number;
  late: number;
  absent: number;
  outsideLocation: number;
}

export interface AdminAttendanceResponseDto {
  records: AttendanceRecordResponseDto[];
  metrics: AdminAttendanceMetricsDto;
  /** Live filter values: Present, Absent, Outside Location. */
  statusOptions: AttendanceStatus[];
}

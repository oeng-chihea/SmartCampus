import {
  AttendanceLocationStatus,
  AttendanceStatus,
} from '../../../common/constants/status.constant';
import { AttendanceRecordResponseDto } from './attendance-record-response.dto';

export interface AdminAttendanceMetricsDto {
  present: number;
  /** @deprecated Attendance status now has only Present and Absent. */
  late: number;
  absent: number;
  outsideLocation: number;
}

export interface AdminAttendanceResponseDto {
  records: AttendanceRecordResponseDto[];
  metrics: AdminAttendanceMetricsDto;
  /** Live geofence filter values: Inside, Outside Location. */
  statusOptions: AttendanceLocationStatus[];
  /** Live attendance filter values: Present, Absent. */
  attendanceStatusOptions: AttendanceStatus[];
}

/** Attendance statuses (FR-06) */
export const ATTENDANCE_STATUS = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  outsideLocation: 'Outside Location',
} as const;

export type AttendanceStatus =
  (typeof ATTENDANCE_STATUS)[keyof typeof ATTENDANCE_STATUS];
